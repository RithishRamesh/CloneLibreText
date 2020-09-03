const express = require('express');
const app = express();
const {resolve} = require('path');
const fs = require('fs-extra');
const cors = require('cors');
const fetch = require("node-fetch");
const readline = require('readline');
const {google} = require('googleapis');
const mailComposer = require('nodemailer/lib/mail-composer');
require('dotenv').config({path: './.env'});
const bookstoreConfig = require("./bookstoreConfig.json");
const stripe = require('stripe')(bookstoreConfig.STRIPE_SECRET_KEY);
const taxMultiplier = parseFloat(bookstoreConfig.TAX_MULTIPLIER);
const {ClientCredentials} = require('simple-oauth2');
const basePath = '/bookstore';
let port = 3008;
if (process.argv.length >= 3 && parseInt(process.argv[2])) {
	port = parseInt(process.argv[2]);
}

app.use(express.static(bookstoreConfig.STATIC_DIR));
app.use(cors());
app.use(
	express.json({
		// We need the raw body to verify webhook signatures.
		// Let's compute it only when hitting the Stripe webhook endpoint.
		verify: function (req, res, buf) {
			if (req.originalUrl.startsWith(basePath + '/publish-order')) {
				req.rawBody = buf.toString();
			}
		},
	})
);

//test html
app.get(basePath + '/', (req, res) => {
	const path = resolve(bookstoreConfig.STATIC_DIR + '/index.html');
	res.sendFile(path);
});

//send public key to client
app.get(basePath + '/stripeInitialize', async (req, res) => {
	res.send({
		publicKey: bookstoreConfig.STRIPE_PUBLISHABLE_KEY,
	});
});

async function updateOrder(sessionId, forceUpdate = false) {
	let result = {};
	let writePath;
	if (await fs.exists(`./bookstore/complete/${sessionId}.json`)) {
		writePath = `./bookstore/complete/${sessionId}.json`;
		result = await fs.readJSON(writePath);
	}
	else if (await fs.exists(`./bookstore/pending/${sessionId}.json`)) {
		writePath = `./bookstore/pending/${sessionId}.json`;
		result = await fs.readJSON(writePath);
		forceUpdate = true;
	}
	else return null //Not found
	
	//update Stripe information
	// const session = await stripe.checkout.sessions.retrieve(sessionId);
	
	//update Lulu information
	if (forceUpdate) {
		if (result.luluID) { //fetch live lulu
			let luluResponse = await LuluAPI(`https://api.lulu.com/print-jobs/${result.luluID}/`, {
				headers: {
					'Cache-Control': 'no-cache',
					'Content-Type': 'application/json'
				}
			});
			if (luluResponse.ok) {
				luluResponse = await luluResponse.json();
				result.lulu = luluResponse;
				result.status = luluResponse.status.name;
				await fs.writeJSON(writePath, result, {spaces: '\t'});
			}
			else
				console.error(JSON.stringify(await luluResponse.json()));
		}
		
		//Maybe add order fulfillment if VERIFIED? May cause signficiant issues if autopay is enabled.
		
		//archive order if completed
		if (writePath.startsWith('./bookstore/pending') && ['SHIPPED', 'REJECTED', 'CANCELED'].includes(result.status)) {
			console.log(`[Archiving] ${sessionId}`)
			await fs.move(writePath, `./bookstore/complete/${sessionId}.json`);
		}
	}
	return result;
}

// Fetch the Checkout Session to display the JSON result on the success page
app.get(basePath + '/get-order', async (req, res) => {
	const {sessionId, forceUpdate} = req.query;
	let result = await updateOrder(sessionId, forceUpdate);
	res.send(result);
});

//send LibreTexts info to Stripe
app.post(basePath + '/create-lulu-checkout-session', async (req, res) => {
	const domainURL = bookstoreConfig.DOMAIN;
	const {shoppingCart, shippingSpeed} = req.body;
	let totalQuantity = 0;
	
	//turn items into lineItems
	// console.log('Hello!');
	let lineItems = shoppingCart;
	let costCalculation = lineItems.map((item) => {
		totalQuantity += item.quantity;
		return {
			"page_count": item.metadata.numPages,
			"pod_package_id": `0850X1100${item.color ? 'FC' : 'BW'}STD${item.hardcover ? 'CW' : 'PB'}060UW444MXX`,
			"quantity": item.quantity
		}
	});
	let shipping = fetch(`https://api.lulu.com/print-shipping-options?iso_country_code=US&state_code=US-CA&quantity=${totalQuantity}&level=${shippingSpeed}&pod_package_id=0850X1100BWSTDCW060UW444MXX`, {
		headers: {
			// 'Cache-Control': 'no-cache',
			'Content-Type': 'application/json'
		}
	});
	costCalculation = await LuluAPI('https://api.lulu.com/print-job-cost-calculations/', {
		method: 'POST',
		headers: {
			'Cache-Control': 'no-cache',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			"line_items": costCalculation,
			"shipping_address": {
				"city": "Davis",
				"country_code": "US",
				"postcode": "95616",
				"state_code": "CA",
				"street1": "One Shields Avenue"
			},
			"shipping_level": shippingSpeed
		})
	});
	costCalculation = await costCalculation.json();
	// console.log(JSON.stringify(costCalculation, null, 2));
	
	lineItems = lineItems.map((item, index) => {
		let costCalcItem = costCalculation.line_item_costs[index];
		const discount = item.metadata.libreNet || true;
		const price = (discount ? costCalcItem.total_cost_excl_tax : costCalcItem.total_cost_excl_discounts) * taxMultiplier;
		return {
			price_data: {
				currency: 'usd',
				product_data: {
					name: item.metadata.title,
					images: [`https://${item.metadata.subdomain}.libretexts.org/@api/deki/pages/${item.metadata.id}/files/=mindtouch.page%2523thumbnail`],
					metadata: {
						title: item.metadata.title,
						library: item.metadata.subdomain,
						pageID: item.metadata.id,
						hardcover: item.hardcover,
						color: item.color,
						libreNet: true,
						numPages: item.metadata.numPages,
					},
				},
				unit_amount: Math.ceil(price * 100 / item.quantity) //amount in cents
			},
			quantity: item.quantity,
			description: `${item.hardcover ? 'Hardcover' : 'Paperback'},  ${item.color ? 'Color' : 'Black&White'}${discount ? ',  LibreNet bulk discount on quantities >=30' : ''}`
		}
	})
	
	//process shipping
	shipping = await (await shipping).json();
	shipping = shipping.results[0];
	lineItems.push({
		price_data: {
			currency: 'usd',
			product_data: {
				name: `Textbook Shipping [${shippingSpeed}]`,
				metadata: {shippingSpeed: shippingSpeed},
			},
			unit_amount: Math.ceil(costCalculation.shipping_cost.total_cost_excl_tax * 100 * taxMultiplier) //amount in cents
		},
		description: `Estimated arrival in ${shipping.total_days_min}-${shipping.total_days_max} days`,
		quantity: 1,
	});
	// console.log(JSON.stringify(lineItems, null, 2));
	/*res.send({
		lineItems: lineItems,
	});
	return*/
	
	// Create new Checkout Session for the order
	// Other optional params include:
	// [billing_address_collection] - to display billing address details on the page
	// [customer] - if you have an existing Stripe Customer ID
	// [customer_email] - lets you prefill the email input in the Checkout page
	// For full details see https://stripe.com/docs/api/checkout/sessions/create
	const session = await stripe.checkout.sessions.create({
		payment_method_types: bookstoreConfig.PAYMENT_METHODS.split(', '),
		mode: 'payment',
		line_items: lineItems,
		shipping_address_collection: {allowed_countries: ['US']},
		// ?session_id={CHECKOUT_SESSION_ID} means the redirect will have the session ID set as a query param
		success_url: `${domainURL}/Order_Success.html?order={CHECKOUT_SESSION_ID}`,
		cancel_url: `${domainURL}/Purchase_Canceled.html`,
	});
	// console.log(session.id);
	res.send({
		sessionId: session.id,
	});
});

app.post(basePath + '/publish-order', async (req, res) => {
	let data;
	let eventType;
	// Check if webhook signing is configured.
	if (bookstoreConfig.STRIPE_WEBHOOK_SECRET) {
		// Retrieve the event by verifying the signature using the raw body and secret.
		let event;
		let signature = req.headers['stripe-signature'];
		
		try {
			event = stripe.webhooks.constructEvent(
				req.rawBody,
				signature,
				bookstoreConfig.STRIPE_WEBHOOK_SECRET
			);
		} catch (err) {
			console.log(`⚠️  Webhook signature verification failed.`);
			return res.sendStatus(400);
		}
		data = event.data
		eventType = event.type;
	}
	if (eventType && eventType === 'checkout.session.completed') {
		// console.log(`🔔  Payment received!`);
		const session = data.object;
		// console.log(session);
		
		// Fulfill the purchase...
		fulfillOrder(session.id).then();
	}
	
	res.sendStatus(200);
});

app.listen(port, () => console.log(`Restarted Bookstore on port ${port}`));

// fulfillOrder('cs_live_8oBYmoc2yxZCSNWcYt33J52t3OXtkSDwLgnmtRdXOpfAPNZMWi9PBB7i')

async function fulfillOrder(session) {
	await fs.ensureDir('./bookstore/pending');
	await fs.ensureDir('./bookstore/complete');
	const logDestination = `./bookstore/pending/${session}.json`;
	session = await stripe.checkout.sessions.retrieve(
		session,
		{
			expand: ['line_items', 'line_items.data.price.product', 'customer'],
		}
	);
	
	// console.log("Fulfilling order", JSON.stringify(session, null, 2));
	let lineItems = session.line_items.data;
	
	//TODO replace with optional chaining
	if (!lineItems || !lineItems.length || !lineItems[0].price.product.metadata.numPages) {
		console.error(`[Invalid Lulu order] ${session.id}`);
		return;
	}
	
	let shippingSpeed = lineItems.pop();
	shippingSpeed = shippingSpeed.price.product.metadata.shippingSpeed || "MAIL";
	lineItems = lineItems.map(item => {
		return {
			quantity: item.quantity,
			...item.price.product.metadata
		}
	})
	lineItems = lineItems.map((item) => {
		const line_item_PDF = `${bookstoreConfig.PDF_ROOT}/${item.library}-${item.pageID}/Publication`; //web location of PDF files
		return {
			external_id: `${item.library}-${item.pageID}`,
			title: item.title.replace(/\n/g, ' '),
			cover: `${line_item_PDF}/Cover_${item.hardcover === 'true' ? 'Casewrap' : 'PerfectBound'}.pdf`,
			interior: `${line_item_PDF}/Content.pdf`,
			pod_package_id: `0850X1100${item.color === 'true' ? 'FC' : 'BW'}STD${item.hardcover === 'true' ? 'CW' : 'PB'}060UW444MXX`,
			page_count: parseInt(item.numPages),
			quantity: item.quantity,
		}
	});
	await fs.writeJSON(logDestination, {
		stripeID: session.id,
		luluID: null,
		status: 'VERIFIED',
		stripe: session,
		lulu: null,
	}, {spaces: '\t'});


//send request to the Lulu API
	const payload = {
		contact_email: bookstoreConfig.RECEIPT_EMAIL,
		external_id: session.id,
		production_delay: 120,
		line_items: lineItems,
		shipping_address: {
			"city": session.shipping.address.city,
			"country_code": session.shipping.address.country,
			"name": session.shipping.name,
			// "phone_number": "844-212-0689",
			"email": session.customer.email,
			"postcode": session.shipping.address.postal_code,
			"state_code": session.shipping.address.state,
			"street1": session.shipping.address.line1,
			"street2": session.shipping.address.line2,
		},
		shipping_level: shippingSpeed,
	}
	
	let luluResponse = await LuluAPI('https://api.lulu.com/print-jobs/', {
		method: 'POST',
		headers: {
			'Cache-Control': 'no-cache',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(payload)
	});
	if (luluResponse.ok) {
		luluResponse = await luluResponse.json();
		
		console.log(`[Fulfilling order] ${session.id}`);
		await fs.writeJSON(logDestination, {
			stripeID: session.id,
			luluID: luluResponse.id,
			status: luluResponse.status.name,
			stripe: session,
			lulu: luluResponse,
		}, {spaces: '\t'});
		
		sendLuluReceipt(payload, luluResponse);
	}
	else {
		console.error(luluResponse);
	}
}

async function LuluAPI(url, options) {
	const config = {
		client: {
			id: bookstoreConfig.LULU_PUBLISHABLE_KEY,
			secret: bookstoreConfig.LULU_SECRET_KEY,
		},
		auth: {
			tokenHost: 'https://api.lulu.com',
			tokenPath: '/auth/realms/glasstree/protocol/openid-connect/token'
		}
	};
	const client = new ClientCredentials(config);
	let accessToken;
	try {
		accessToken = await client.getToken();
	} catch (error) {
		console.log('Access Token error', error);
	}
	options.headers = options.headers || {};
	options.headers.Authorization = `Bearer ${accessToken.token.access_token}`;
	return await fetch(url, options);
}

function sendLuluReceipt(payload, luluResponse) {
	const to = payload.shipping_address.email;
	const sub = 'Thank you for your order from the LibreTexts Bookstore!';

// If modifying these scopes, delete token.json.
	const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
	const TOKEN_PATH = './bookstore/token.json';

// Load client secrets from a local file.
	fs.readFile('bookstoreConfig.json', (err, content) => {
		if (err) return console.log('Error loading client secret file:', err);
		// Authorize a client with credentials, then call the Gmail API.
		authorize(JSON.parse(content).GMAIL, (auth) => {
			const email = new CreateMail(auth, to, sub, message);
			email.makeBody();
		});
	});
	
	/**
	 * Create an OAuth2 client with the given credentials, and then execute the
	 * given callback function.
	 * @param {Object} credentials The authorization client credentials.
	 * @param {function} callback The callback to call with the authorized client.
	 */
	function authorize(credentials, callback) {
		const {client_secret, client_id, redirect_uris} = credentials.installed;
		const oAuth2Client = new google.auth.OAuth2(
			client_id, client_secret, redirect_uris[0]);
		
		// Check if we have previously stored a token.
		fs.readFile(TOKEN_PATH, (err, token) => {
			if (err) return getNewToken(oAuth2Client, callback);
			oAuth2Client.setCredentials(JSON.parse(token));
			callback(oAuth2Client);
		});
	}
	
	/**
	 * Get and store new token after prompting for user authorization, and then
	 * execute the given callback with the authorized OAuth2 client.
	 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
	 * @param {getEventsCallback} callback The callback for the authorized client.
	 */
	function getNewToken(oAuth2Client, callback) {
		const authUrl = oAuth2Client.generateAuthUrl({
			access_type: 'offline',
			scope: SCOPES,
		});
		console.log('Authorize this app by visiting this url:', authUrl);
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		rl.question('Enter the code from that page here: ', (code) => {
			rl.close();
			oAuth2Client.getToken(code, (err, token) => {
				if (err) return console.error('Error retrieving access token', err);
				oAuth2Client.setCredentials(token);
				// Store the token to disk for later program executions
				fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
					if (err) return console.error(err);
					console.log('Token stored to', TOKEN_PATH);
				});
				callback(oAuth2Client);
			});
		});
	}
	
	/**
	 * Sends a test email using the user's account.
	 *
	 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
	 */
		
		
		//creation of message from payload and line_items
	const message = `<h1>Thank you for your order from the LibreTexts bookstore!</h1>
<p>This email is confirmation that your payment has been approved and that the printer has received your order.</p>
<p> You can view the live status of your order on this page:
<a href="https://libretexts.org/bookstore/Order_Success.html?order=${payload.external_id}">https://libretexts.org/bookstore/Order_Success.html?order=${payload.external_id}</a></p>
<table class="items" style="width: 100%; border-spacing: 0; border-collapse: collapse;">
<thead><tr>
<th colspan="3" style="font-family: 'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif; background-color: #f8f8f8; border-radius: 0px 0px 0px 0px; border: solid 0px #eaecec; padding: 12px; color: #325f74; font-size: 18px; font-weight: bold; border-bottom: solid 2px #eaecec;">Products Ordered</th>
</tr></thead>
<tbody>
${payload.line_items.map(item => `<tr>
        <td>
        <p class="item-qty" style="margin-top: 0; margin-bottom: 0px;">QTY: ${item.quantity}</p>
        <h3 class="product-name-custom" style="margin-top: 0; margin-bottom: 0px; color: #0080ac; font-weight: bold;">${item.title}</h3>
        <p class="sku-custom" style="margin-top: 0; margin-bottom: 0px;"><em style="font-style: italic;">${item.external_id}</em></p>
        </td>
        <td>
        <p>Shipping to <u>${payload.shipping_address.city}, ${payload.shipping_address.state_code}</u> via <i>${payload.shipping_level}</i></p>
        </td>
        <td>
        <p>Estimated arrival from <b>${luluResponse.estimated_shipping_dates.arrival_min}</b> to ${luluResponse.estimated_shipping_dates.arrival_max}</p>
        </td>
</tr>`)}
</tbody>
</table>

<br/>
<p>If you encounter any issues with your order, don't hesitate contact us at bookstore@libretexts.org.</p>
<p>Please remember to include your order identifier [${payload.external_id}].</p>
<h3>Enjoy your purchase!</h3>
<img src="https://test.libretexts.org/hagnew/development/public/Henry%20Agnew/Bookstore/images/libretexts_section_complete_bookstore_header.png" alt="LibreTexts" class="linkIcon" title="LibreTexts Bookstore" width="350" height="124">`
	
	
	class CreateMail {
		constructor(auth, to, sub, body) {
			this.me = bookstoreConfig.RECEIPT_EMAIL;
			this.auth = auth;
			this.to = to;
			this.sub = sub;
			this.body = body;
			this.gmail = google.gmail({version: 'v1', auth});
			
		}
		
		//Creates the mail body and encodes it to base64 format.
		makeBody() {
			
			let mail;
			//Mail Body is created.
			mail = new mailComposer({
				to: this.to,
				from: 'LibreTexts Bookstore <bookstore@libretexts.org>',
				html: this.body,
				subject: this.sub,
				textEncoding: "base64"
			});
			
			//Compiles and encodes the mail.
			mail.compile().build((err, msg) => {
				if (err) {
					return console.log('Error compiling email ' + error);
				}
				
				const encodedMessage = Buffer.from(msg)
					.toString('base64')
					.replace(/\+/g, '-')
					.replace(/\//g, '_')
					.replace(/=+$/, '');
				
				this.sendMail(encodedMessage);
				
			});
		}
		
		//Send the message to specified receiver.
		sendMail(encodedMessage) {
			this.gmail.users.messages.send({
				userId: this.me,
				resource: {
					raw: encodedMessage,
				}
			}, (err, result) => {
				if (err) {
					return console.log('NODEMAILER - The API returned an error: ' + err);
				}
				
				// console.log("NODEMAILER - Sending email reply from server:", result.data);
			});
		}
	}
}