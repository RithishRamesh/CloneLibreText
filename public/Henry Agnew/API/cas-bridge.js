window.addEventListener('load', async () => {
	let login = document.getElementById('emailHolder').innerText;
	let payload = Cookies.get();
	const $content = $(".mt-content-container");
	const $target = $('.mt-user-quick-login');
	
	if (login) {
		// $content.before(`<p>libreTextsLogin: ${login}</p>`);
		return;
	}
	else if (payload && payload.overlayJWT) {
		payload = payload.overlayJWT;
		
		let pubKey = await fetch('https://api.libretexts.org/cas-bridge/public');
		pubKey = await pubKey.text();
		try {
			login = KJUR.jws.JWS.verify(payload, pubKey, ["PS256"]);
			if (login) {
				payload = KJUR.jws.JWS.parse(payload).payloadObj;
				login = payload.email || payload.user;
			}
		} catch (e) {
			console.error(e);
		}
		console.log(login, payload);
		
		if (login) {
			// $("#title").append('<button id="cas-test" onclick="logoutCAS()">Logout</button>');
			$target.replaceWith(`<li><a class="icon-SSO sso-user" title="Single Sign-On" onclick="logoutCAS()">${payload.name}</a></li>`)
			$('.elm-header-user-nav').css('background-color', 'grey');
			$('.elm-header-user-nav .mt-user-menu > li > a').css('color', 'white');
			// $content.before(`<p>Thank you ${login} for authenticating with LibreTexts SSO!</p>`);
			return;
		}
	}
	
	if ($target) {
		$target.before(`<li><a class="icon-SSO" title="Single Sign-On" onclick="loginCAS()"/></li>`)
	}
});

function loginCAS() {
	Cookies.set('api_redirect', window.location.href, {domain: 'libretexts.org'});
	window.location = 'https://api.libretexts.org/cas-bridge';
}

function logoutCAS() {
	Cookies.remove('overlayJWT', {domain: 'libretexts.org'});
	location.reload();
	//window.location = 'https://sso.libretexts.org/cas/logout';
}