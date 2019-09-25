import React, {useEffect, useState} from 'react';
import RemixerFunctions from "../reusableFunctions";
import Tooltip from "@material-ui/core/Tooltip";
import Info from "@material-ui/core/SvgIcon/SvgIcon";
import Button from "@material-ui/core/Button";
import ArrowBack from "@material-ui/icons/ArrowBack";
import Publish from "@material-ui/icons/Publish";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Paper from "@material-ui/core/Paper";
import Tabs from "@material-ui/core/Tabs";
import AppBar from "@material-ui/core/AppBar";
import Tab from "@material-ui/core/Tab";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import Description from "@material-ui/icons/Description";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import {FixedSizeList} from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import LibreText from "../../../Downloads Center/src/components/LibreText";
import {Switch} from "@material-ui/core";
import Toolbar from "@material-ui/core/Toolbar";
import FormControlLabel from "@material-ui/core/FormControlLabel";


export default function PublishPanel(props) {
	let permission = RemixerFunctions.userPermissions(true);
	let [pageArray, setPageArray] = useState([]);
	let [sorted, setSorted] = useState({});
	const [panel, setPanel] = React.useState('summary');
	let [initialized, setInitialized] = React.useState();
	let [working, setWorking] = React.useState();
	
	useEffect(() => {
		let LTPreview = $('#LTPreviewForm');
		if (!LTPreview)
			return;
		else if (panel === 'tree') {
			if (!initialized) {
				LTPreview.fancytree({
					source: props.RemixTree,
					debugLevel: 0,
					autoScroll: true,
				});
				setInitialized(true);
			}
		}
	});
	
	function sortPages() {
		let tree = props.RemixTree;
		let arrayResult = addLinks(tree, '');
		let objectResult = {};
		
		function addLinks(parent, parentPath) {
			parent = {...parent, ...parent.data};
			parent.path = parent.key === "ROOT" ? '' : `${parentPath}/${parent.padded || parent.title}`;
			let array = parent.key === "ROOT" ? [] : [parent];
			if (parent && parent.children && parent.children.length) {
				parent.children.forEach((child) => {
					array = array.concat(addLinks(child, parent.path));
				});
			}
			return array;
		}
		
		arrayResult.forEach((page) => {
			if (props.type === 'Remix') {
				let copyMode = page.copyMode || props.options.defaultCopyMode;
				if (!page.url)
					copyMode = 'blank'; //pages without a source are blank
				page.copyMode = copyMode;
				
				if (objectResult[copyMode])
					objectResult[copyMode].push(page);
				else
					objectResult[copyMode] = [page];
			}
			else if (props.type === 'ReRemix') {
				if (objectResult[page.status])
					objectResult[page.status].push(page);
				else
					objectResult[page.status] = [page];
			}
		});
		console.log(arrayResult, objectResult);
		setPageArray(arrayResult);
		setSorted(objectResult);
	}
	
	useEffect(() => {
		if (!pageArray || !pageArray.length) {
			sortPages();
		}
	}, [props.RemixTree]);
	
	function generateSummary() {
		const listStyle = {
			flex: 1,
			display: 'flex',
			flexDirection: 'column',
			justifyContent: 'space-evenly',
			fontSize: 'larger'
		};
		if (props.type === 'Remix') {
			return <List style={listStyle}>
				{listItem(sorted.blank, 'unchanged', 'blank pages')}
				{listItem(sorted.transclude, 'new', 'transcluded')}
				{listItem(sorted.fork, 'new', 'forked')}
				{listItem(sorted.full, 'modified', 'full-copied')}
			</List>;
		}
		else if (props.type === 'ReRemix') {
			return <List style={listStyle}>
				{listItem(sorted.new, 'new', 'added')}
				{listItem(sorted.modified, 'modified', 'modified')}
				{listItem(sorted.deleted, 'deleted', 'deleted')}
				{listItem(sorted.unchanged, 'unchanged', ' unchanged')}
			</List>;
		}
		else
			return <div style={{flex: 1}}>Invalid Mode</div>;
		
		function listItem(array, statusColor, text) {
			let length = 0;
			statusColor = RemixerFunctions.statusColor(statusColor);
			if (array && array.length)
				length = array.length;
			return <ListItem style={{color: statusColor}}><ListItemIcon>
				<Description style={{color: statusColor}}/>
			</ListItemIcon>
				{length} pages will be {text}
			</ListItem>;
		}
	}
	
	return <div id='LTForm' className='publishPanel'>
		<div className="LTFormHeader" style={{backgroundColor: permission.color}}>
			<div className='LTTitle'><Tooltip title={permission.description}>
				<div style={{display: 'flex', alignItems: 'center'}}>{props.mode} Mode
					<Info style={{marginLeft: 10}}/></div>
			</Tooltip></div>
		</div>
		<div id='LTFormContainer'>
			<Paper>
				<AppBar position="static" style={{backgroundColor: '#F44336'}}>
					<Tabs value={panel} onChange={(e, v) => setPanel(v)} centered
					      aria-label="wrapped label tabs example">
						<Tab value="summary" label="Publish Summary"/>
						<Tab
							value="tree"
							label="LibreText Preview"
						/>
					</Tabs>
				</AppBar>
				{panel === 'summary' ? generateSummary() : null}
				<div id='LTPreviewForm' className='treePanel'
				     style={{display: panel === 'tree' ? 'flex' : 'none'}}></div>
				<ButtonGroup
					variant="outlined"
					size="large"
					style={{marginTop: 10}}
					aria-label="large contained secondary button group">
					<Tooltip title="This will save your work to a file that you can download to your computer.">
						<Button onClick={() => props.updateRemixer({stage: 'Remixing'})}>
							<ArrowBack/>Revise
						</Button>
					</Tooltip>
					<Tooltip title="This will load a Remix from a file and replace your current workspace.">
						<Button color='primary' onClick={() => setWorking(pageArray)}>
							Publish<Publish/>
						</Button>
					</Tooltip>
				</ButtonGroup>
			</Paper>
			<PublishSubPanel {...props} working={working}/>
		</div>
	</div>;
}

function PublishSubPanel(props) {
	const [counter, setCounter] = useState(0);
	const [results, setResults] = useState([]);
	const [seconds, setSeconds] = useState(-1);
	const [state, setState] = useState('');
	const [finished, setFinished] = useState('');
	let [show, setShow] = React.useState({success: true, failed: true});
	
	
	useEffect(() => {
		if (props.working) {
			console.log('Publishing!!!');
			publish().then();
		}
	}, [props.working]);
	
	useEffect(() => { //timer
		const interval = setInterval(() => {
			setSeconds(seconds => seconds !== -1 ? seconds + 1 : seconds);
		}, 1000);
		return () => clearInterval(interval);
	}, []);
	
	return <Paper>
		{generateStatusBar()}
		<div id="results">
			<AutoSizer disableHeight={true}>
				{({height, width}) => (
					<FixedSizeList
						className="List"
						height='60vh'
						itemCount={results.length}
						itemSize={15}
						width={width}
					>
						{({index, style}) => {
							let page = results[index];
							if (page.isFailed && show.failed)
								return <div style={{color: 'red'}}
								            key={results.length - index - 1}>{results.length - index - 1} FAILED&nbsp;
									<a target='_blank' href={page.url}>{page.title}</a></div>;
							else if (!page.isFailed && show.success)
								return <div style={{color: page.color}}
								            key={results.length - index - 1}>{results.length - index - 1} {page.type}&nbsp;
									<a target='_blank' href={page.url}>{page.title}</a></div>;
							else return null;
						}}
					</FixedSizeList>
				)}
			</AutoSizer>
		</div>
		<AppBar position="static" style={{backgroundColor: RemixerFunctions.userPermissions(true).color}}>
			<Toolbar style={{display: 'flex', flexDirection: 'column'}}>
				<div style={{display: 'flex', justifyContent: 'space-evenly'}}>
					<FormControlLabel
						style={{display: 'flex', alignItems: 'center', margin: '0 5px 0 0'}}
						control={
							<Switch
								inputProps={{'aria-label': 'primary checkbox'}}
								checked={show.success}
								onChange={() => setShow({...show, ...{success: !show.success}})}
							/>}
						label="Show Successful"/>
					<FormControlLabel
						style={{display: 'flex', alignItems: 'center', margin: '0 5px 0 0'}}
						control={
							<Switch
								inputProps={{'aria-label': 'primary checkbox'}}
								checked={show.failed}
								onChange={() => setShow({...show, ...{failed: !show.failed}})}
							/>}
						label="Show Failed"/>
				</div>
				{finished ?
					<h6><a href={finished} target='_blank'>Your new LibreText will be available here</a></h6> : null}
			</Toolbar>
		</AppBar>
	</Paper>;
	
	function generateStatusBar() {
		switch (state) {
			case 'processing':
				return <div className="status" style={{backgroundColor: 'orange'}}>
					<div>
						Publish In Progress
						({counter.percentage})<br/>
						{counter.pages} / {props.working.length}
					</div>
					<div className="spinner">
						<div className="bounce1"/>
						<div className="bounce2"/>
						<div className="bounce3"/>
					</div>
					<div>
						{`Time Elapsed: ${seconds} seconds`}<br/>
						{`Time Remaining: ${counter.eta}`}
					</div>
				</div>;
			case 'done':
				return <div className="status"
				            style={{backgroundColor: 'green', display: 'flex', flexDirection: 'column'}}>Import
				                                                                                         Complete! View
				                                                                                         your results
				                                                                                         here <a
						target='_blank'
						href={finished}>{finished}</a>
				</div>;
			default:
				return <div className="status"
				            style={{backgroundColor: 'grey', display: 'flex', flexDirection: 'column'}}>Results
				</div>;
		}
	}
	
	async function publish() {
		if (props.institution === '') {
			if (confirm('Would you like to send an email to info@libretexts.com to request your institution?'))
				window.location.href = 'mailto:info@libretexts.org?subject=Remixer%20Institution%20Request';
			return false;
		}
		if (!props.name) {
			alert('No LibreText name provided!');
			return false;
		}
		
		setState('processing');
		setCounter({
			percentage: 0,
			pages: 0,
			eta: 'Calculating',
		});
		setSeconds(0);
		setResults([]);
		console.log(props);
		let destRoot = props.institution;
		if (destRoot.includes('Remixer_University')) {
			destRoot += `/Username:_${document.getElementById('usernameHolder').innerText}`;
			await LibreTexts.authenticatedFetch(destRoot, 'contents?edittime=now', null, {
				method: 'POST',
				body: '<p>{{template.ShowOrg()}}</p><p class=\"template:tag-insert\"><em>Tags recommended by the template: </em><a href=\"#\">article:topic-category</a></p>',
			});
		}
		destRoot = `${destRoot}/${props.name.replace(/ /g, '_')}`;
		let response = await LibreTexts.authenticatedFetch(destRoot, 'info');
		/*if (response.ok) { TODO: Reenable
			alert(`The page ${destRoot} already exists!`);
			return false;
		}*/
		
		if (props.mode === 'Anonymous') {
			if (confirm('Thanks for trying out the OER Remixer in Demonstration mode!\n\nIf you are interested, contact us to get a free account so that you can publish your own LibreText! Would you like to send an email to info@libretexts.com to get started?'))
				window.location.href = 'mailto:info@libretexts.org?subject=Remixer%20Account%20Request';
			return false;
		}
		let startedAt = new Date();
		
		//process cover
		await LibreTexts.authenticatedFetch(destRoot, `contents?abort=exists`, null, {
			method: 'POST',
			body: '<p>{{template.ShowOrg()}}</p><p class=\"template:tag-insert\"><em>Tags recommended by the template: </em><a href=\"#\">article:topic-category</a><a href=\"#\">coverpage:yes</a></p>',
		});
		await putProperty('mindtouch.idf#subpageListing', 'simple', destRoot);
		setFinished(destRoot);
		for (const page of props.working) {
			await processPage(page);
		}
		setState('done');
		
		function completedPage(page, text, color, isFailed) {
			setCounter(
				(counter) => {
					const total = props.working.length;
					let current = counter.pages + 1;
					const elapsed = (new Date() - startedAt) / 1000;
					const rate = current / elapsed;
					const estimated = total / rate;
					const eta = estimated - elapsed;
					
					return {
						percentage: `${Math.round(current / total * 1000) / 10}%`,
						pages: current,
						eta: secondsToStr(eta),
					}
				}
			);
			setResults(results => {
				results.unshift({
					title: page.title,
					url: page.url,
					color: color,
					isFailed: isFailed,
				});
				return results
			});
		}
		
		async function processPage(page) {
			let url = destRoot + (page.path);
			
			if (page.status === 'new' || page.status === 'edited') {
				let contents, response, source;
				//TODO: Title and Move for ReRemix
				
				if (page.copyMode === 'blank') {
					contents = `<p class=\"template:tag-insert\"><em>Tags recommended by the template: </em><a href=\"#\">article:${page.articleType}</a></p>`;
					if (['topic-category', 'topic-guide'].includes(page.articleType))
						contents = '<p>{{template.ShowOrg()}}</p>' + contents;
					
					response = await LibreTexts.authenticatedFetch(url, `contents?edittime=now&dream.out.format=json&title=${encodeURIComponent(page.title)}`, null, {
						method: 'POST',
						body: contents,
					});
					if (!response.ok) {
						completedPage(page, `New blank ${RemixerFunctions.articleTypeToTitle(page.articleType)}`, 'new', true);
					}
					else {
						if (page.articleType === 'topic-guide') {
							await Promise.all([putProperty("mindtouch.idf#guideDisplay", "single", url),
								putProperty('mindtouch.page#welcomeHidden', true, url),
								putProperty("mindtouch#idf.guideTabs", "[{\"templateKey\":\"Topic_hierarchy\",\"templateTitle\":\"Topic hierarchy\",\"templatePath\":\"MindTouch/IDF3/Views/Topic_hierarchy\",\"guid\":\"fc488b5c-f7e1-1cad-1a9a-343d5c8641f5\"}]", url)]
							)
						}
						else if (page.articleType === 'topic-category')
							await putProperty('mindtouch.idf#subpageListing', 'simple', url);
						
						
						await putProperty('mindtouch.page#welcomeHidden', true, url);
						if (page.tags.includes('article:topic-category') || page.tags.includes('article:topic-guide')){
							let image = await fetch('https://chem.libretexts.org/@api/deki/files/239314/default.png?origin=mt-web');
							image = await image.blob();
							await LibreTexts.authenticatedFetch(path, 'files/=mindtouch.page%2523thumbnail', null, {
								method: 'PUT',
								body: image,
							})
						}
						completedPage(page, `New blank ${RemixerFunctions.articleTypeToTitle(page.articleType)}`, 'new');
					}
					return;
				} // end for new pages
				
				switch (page.copyMode) {
					case 'transclude':
						const [currentSubdomain] = LibreTexts.parseURL();
						source = LibreTexts.getAPI(url);
						source.tags.push('transcluded:yes');
						
						source.push(`source-[${index}]-${source.subdomain}-${source.id}`);
						
						if (currentSubdomain !== source.subdomain) {
							contents = `<p className="mt-script-comment">Cross Library Transclusion</p>

<pre className="script">
template('CrossTransclude/Web',{'Library':'${source.subdomain}','PageID':${source.id}});</pre>

<div className="comment">
<div className="mt-comment-content">
<p><a href="${source.url}">Cross-Library Link: ${source.url}</a><br/>source-${source.subdomain}-${source.id}</p>
</div>
${renderTags(source.tags)}
</div>`;
						}
						else {
							let [tempSubdomain, tempPath] = LibreTexts.parseURL(url);
							contents = `<div className="mt-contentreuse-widget" data-page="${tempPath}" data-section="" data-show="false">
<pre className="script">
wiki.page("${tempPath}", NULL)</pre>
</div>

<div className="comment">
<div className="mt-comment-content">
<p><a href="${url}">Content Reuse Link: ${url}</a></p>
</div>
${renderTags(source.tags)}
</div>`;
						}
						response = await LibreTexts.authenticatedFetch(url, `contents?edittime=now&dream.out.format=json&title=${encodeURIComponent(page.title)}`, null, {
							method: 'POST',
							body: contents,
						});
						if (!response.ok) {
							completedPage(page, 'Transcluded', 'new', true);
							return;
						}
						completedPage(page, 'Transcluded', 'new');
						break;
					case 'fork':
						//TODO: Fork
						
						completedPage(page, 'Forked', 'new');
						break;
					case 'full':
						//TODO: Full-Copy
						
						completedPage(page, 'Full-Copied', 'modified');
						break;
				}
				//Handle properties
				if (page.articleType === 'topic-guide')
					source.properties = source.properties.concat([{
						name: "mindtouch.idf#guideDisplay",
						value: "single"
					}, {
						name: "mindtouch#idf.guideTabs",
						value: "[{\"templateKey\":\"Topic_hierarchy\",\"templateTitle\":\"Topic hierarchy\",\"templatePath\":\"MindTouch/IDF3/Views/Topic_hierarchy\",\"guid\":\"fc488b5c-f7e1-1cad-1a9a-343d5c8641f5\"}]"
					}]);
				else if (page.articleType === 'topic-category')
					source.properties.push({name: 'mindtouch.idf#subpageListing', value: 'simple'});
				source.properties.push({name: 'mindtouch.page#welcomeHidden', value: true});
				source.properties = [...new Set(source.properties)]; //deduplicate
				await Promise.all(source.properties.map(async prop => putProperty(prop.name, prop.value)));
				
				//Thumbnail
				let files = source.files, image;
				if (files.includes('mindtouch.page#thumbnail') || files.includes('mindtouch.page%23thumbnail'))
					image = await LibreTexts.authenticatedFetch(source.url, 'thumbnail', child.data.subdomain);
				
				else if (tags.includes('article:topic-category') || tags.includes('article:topic-guide'))
					image = await fetch('https://chem.libretexts.org/@api/deki/files/239314/default.png?origin=mt-web');
				if (image) {
					image = await image.blob();
					await LibreTexts.authenticatedFetch(path, 'files/=mindtouch.page%2523thumbnail', null, {
						method: 'PUT',
						body: image,
					})
				}
				
				completedPage(page, 'Modified', 'modified');
				return;
			}
			else if (page.status === 'deleted') {
				await LibreTexts.authenticatedFetch(path, '', null, {
					method: 'DELETE',
					body: image,
				});
				completedPage(page, 'Deleted', 'deleted');
			}
			else if (page.status === 'unchanged') {
				completedPage(page, 'Skipped', 'unchanged');
			}
			
			function renderTags(tags) {
				let tagsHTML = tags.map((tag) => <a href="#">${tag}</a>).join('');
				return `<p class=\"template:tag-insert\"><em>Tags recommended by the template: </em>${tagsHTML}</p>`
			}
			
			/*for (let i = 0; i < tree.length; i++) {
				const child = tree[i];
				child.title = child.title.replace(/[{}]/g, '');
				child.data.padded = child.data.padded ? child.data.padded.replace(/[{}]/g, '') : false;
				let url = destRoot + '/' + (child.data.padded || child.title);
				let path = url.replace(window.location.origin + '/', '');
				if (!child.data.url) { //New Page
					const isGuide = depth === 1;
					await fetch('/@api/deki/pages/=' + encodeURIComponent(encodeURIComponent(path)) + '/contents?abort=exists', {
						method: 'POST',
						body: isGuide ? '<p>{{template.ShowGuide()}}</p><p className="template:tag-insert"><em>Tags recommended by the template: </em><a href="#">article:topic-guide</a></p>\n'
							: '',
						headers: {'x-deki-token': this.keys[subdomain], 'x-requested-with': 'XMLHttpRequest'},
					});
					let tags = `<tags><tag value="${isGuide ? 'article:topic-guide' : 'article:topic'}"/></tags>`;
					await fetch('/@api/deki/pages/=' + encodeURIComponent(encodeURIComponent(path)) + '/tags', {
						method: 'PUT',
						body: tags,
						headers: {
							'Content-Type': 'text/xml; charset=utf-8',
							'x-deki-token': this.keys[subdomain],
							'x-requested-with': 'XMLHttpRequest',
						},
					});
					// Title cleanup
					if (child.data.padded) {
						fetch('/@api/deki/pages/=' + encodeURIComponent(encodeURIComponent(path)) + '/move?title=' + child.title + '&name=' + child.data.padded, {
							method: 'POST',
							headers: {'x-deki-token': this.keys[subdomain], 'x-requested-with': 'XMLHttpRequest'},
						}).then();
					}
					if (isGuide) {
						await Promise.all(
							[putProperty('mindtouch.idf#guideDisplay', 'single', path),
								putProperty('mindtouch.page#welcomeHidden', true, path),
								putProperty('mindtouch#idf.guideTabs', '[{"templateKey":"Topic_hierarchy","templateTitle":"Topic hierarchy","templatePath":"MindTouch/IDF3/Views/Topic_hierarchy","guid":"fc488b5c-f7e1-1cad-1a9a-343d5c8641f5"}]', path)]);
						
						let current = window.location.origin.split('/')[2].split('.')[0];
						let headers = {
							headers: {
								'x-deki-token': this.keys['chem'],
							},
						};
						if (current === 'chem')
							headers.headers['x-requested-with'] = 'XMLHttpRequest';
						let image = await fetch('https://chem.libretexts.org/@api/deki/files/239314/default.png?origin=mt-web', headers);
						
						image = await image.blob();
						fetch('/@api/deki/pages/=' + encodeURIComponent(encodeURIComponent(path)) + '/files/=mindtouch.page%2523thumbnail', {
							method: 'PUT',
							body: image,
							headers: {
								'x-deki-token': this.keys[subdomain],
								'x-requested-with': 'XMLHttpRequest',
							},
						}).then();
					}
				}
				else { //copying from an exisiting source
					// child.path = child.data.url.replace(window.location.origin + "/", ""); //source
					child.path = child.data.path;
					let content;
					//get info
					let info = await LibreTexts.authenticatedFetch(child.path, 'info?dream.out.format=json', child.data.subdomain);
					
					//get Tags
					let copyMode = document.getElementById('LTFormCopyMode') ? document.getElementById('LTFormCopyMode').value : undefined;
					let copyContent = copyMode && copyMode !== 'transclude';
					let response = await LibreTexts.authenticatedFetch(child.path, 'tags?dream.out.format=json', child.data.subdomain);
					let tags = await response.json();
					if (response.ok && tags['@count'] !== '0') {
						if (tags.tag) {
							if (tags.tag.length) {
								tags = tags.tag.map((tag) => tag['@value']);
							}
							else {
								tags = [tags.tag['@value']];
							}
						}
						copyContent = copyContent || tags.includes('article:topic-category') || tags.includes('article:topic-guide');
						if (!copyContent) {
							tags.push('transcluded:yes');
						}
					}
					else {
						tags = ['transcluded:yes'];
					}
					info = await (await info).json();
					
					tags.push(`source-${child.data.subdomain}-${info['@id']}`);
					let tagsHTML = tags.map((tag) => `<tag value="${tag}"/>`).join('');
					tagsHTML = '<tags>' + tagsHTML + '</tags>';
					
					//copy Content
					let current = window.location.origin.split('/')[2].split('.')[0];
					if (copyContent) {
						if (child.data.subdomain === current) {
							content = await LibreTexts.authenticatedFetch(child.path, 'contents?mode=raw', child.data.subdomain, {isLimited: isDemonstration});
							content = await content.text();
							content = content.match(/<body>([\s\S]*?)<\/body>/)[1].replace('<body>', '').replace('</body>', '');
							content = LibreTexts.decodeHTML(content);
						}
						else {
							//Get cross content
							content = await fetch('https://api.libretexts.org/endpoint/contents', {
								method: 'PUT',
								body: JSON.stringify({
									path: child.path,
									api: 'contents?mode=raw',
									subdomain: child.data.subdomain,
								}),
							});
							content = await content.text();
							content = content.match(/<body>([\s\S]*?)<\/body>/)[1].replace('<body>', '').replace('</body>', '');
							content = LibreTexts.decodeHTML(content);
							
							let copyMode = document.getElementById('LTFormCopyMode') ? document.getElementById('LTFormCopyMode').value : undefined;
							if (copyMode === 'copy') {
								content = content.replace(/\/@api\/deki/g, `https://${child.data.subdomain}.libretexts.org/@api/deki`);
								content = content.replace(/ fileid=".*?"/g, '');
							}
							else if (copyMode === 'deep') {
								//Fancy file transfer VERY SLOW BUT EFFECTIVE
								response = await LibreTexts.authenticatedFetch(child.path, 'files?dream.out.format=json', child.data.subdomain);
								if (response.ok) {
									let files = await response.json();
									if (files['@count'] !== '0') {
										if (files.file) {
											if (!files.file.length) {
												files = [files.file];
											}
											else {
												files = files.file;
											}
										}
									}
									let promiseArray = [];
									for (let i = 0; i < files.length; i++) {
										let file = files[i];
										if (file['@res-is-deleted'] === 'false')
											promiseArray.push(processFile(file, child, path, file['@id']));
									}
									promiseArray = await Promise.all(promiseArray);
									for (let i = 0; i < promiseArray.length; i++) {
										if (promiseArray[i]) {
											content = content.replace(promiseArray[i].original, promiseArray[i].final);
											content = content.replace(`fileid="${promiseArray[i].oldID}"`, `fileid="${promiseArray[i].newID}"`);
										}
									}
								}
								
								// Handling of hotlinked images (not attached to the page)
								response = await LibreTexts.authenticatedFetch(path, 'files?dream.out.format=json');
								if (response.ok) {
									let files = await response.json();
									if (files['@count'] !== '0') {
										if (files.file) {
											if (!files.file.length) {
												files = [files.file];
											}
											else {
												files = files.file;
											}
										}
									}
									files = files.map((file) => file['@id']);
									
									let promiseArray = [];
									let images = content.match(/(<img.*?src="\/@api\/deki\/files\/)[\S\s]*?(")/g);
									if (images) {
										for (let i = 0; i < images.length; i++) {
											images[i] = images[i].match(/src="\/@api\/deki\/files\/([\S\s]*?)["/]/)[1];
											
											if (!files.includes(images[i])) {
												promiseArray.push(processFile(null, child, path, images[i]));
											}
										}
										
										promiseArray = await Promise.all(promiseArray);
										for (let i = 0; i < promiseArray.length; i++) {
											if (promiseArray[i]) {
												content = content.replace(promiseArray[i].original, promiseArray[i].final);
												content = content.replace(`fileid="${promiseArray[i].oldID}"`, `fileid="${promiseArray[i].newID}"`);
											}
										}
									}
								}
							}
						}
					}
					else if (child.data.subdomain !== current) {
						content = `<p className="mt-script-comment">Cross Library Transclusion</p>

<pre className="script">
template('CrossTransclude/Web',{'Library':'${child.data.subdomain}','PageID':${child.data.id}});</pre>

<div className="comment">
<div className="mt-comment-content">
<p><a href="${child.data.url}">Cross-Library Link: ${child.data.url}</a><br/>source-${child.data.subdomain}-${info['@id']}</p>
</div>
</div>`;
					}
					else {
						content = `<div className="mt-contentreuse-widget" data-page="${child.path}" data-section="" data-show="false">
<pre className="script">
wiki.page("${child.path}", NULL)</pre>
</div>

<div className="comment">
<div className="mt-comment-content">
<p><a href="${child.data.url}">Content Reuse Link: ${child.data.url}</a></p>
</div>
</div>`;
					}
					response = await fetch('/@api/deki/pages/=' + encodeURIComponent(encodeURIComponent(path)) + '/contents?edittime=now', {
						method: 'POST',
						body: content,
						headers: {'x-deki-token': this.keys[subdomain], 'x-requested-with': 'XMLHttpRequest'},
					});
					if (response.status >= 400) {
						failedCounter++;
					}
					switch (response.status) {
						case 403:
							errorText += '403 Forbidden - User does not have permission to create' + path + '\n';
							break;
						case 500:
							errorText += '500 Server Error ' + path + '\n';
							break;
						case 409:
							errorText += '409 Conflict - Page already exists ' + path + '\n';
							break;
						default:
							errorText += 'Error ' + response.status + ' ' + path + '\n';
							break;
						case 200:
							//copy Tags
							if (tagsHTML) {
								fetch('/@api/deki/pages/=' + encodeURIComponent(encodeURIComponent(path)) + '/tags', {
									method: 'PUT',
									body: tagsHTML,
									headers: {
										'Content-Type': 'text/xml; charset=utf-8',
										'x-deki-token': this.keys[subdomain],
										'x-requested-with': 'XMLHttpRequest',
									},
								}).then();
							}
							//Properties
							LibreTexts.authenticatedFetch(child.path, 'properties?dream.out.format=json', child.data.subdomain).then(async (response) => {
								let content = await response.json();
								if (content['@count'] !== '0') {
									if (content.property) {
										if (content.property.length) {
											content = content.property.map((property) => {
												return {name: property['@name'], value: property['contents']['#text']};
											});
										}
										else {
											content = [{
												name: content.property['@name'],
												value: content.property['contents']['#text'],
											}];
										}
									}
								}
								for (let i = 0; i < content.length; i++) {
									switch (content[i].name) {
										//subpageListing check
										case 'mindtouch.idf#subpageListing':
											if (tags.includes('article:topic-category')) {
												fetch('/@api/deki/pages/=' + encodeURIComponent(encodeURIComponent(path)) + '/properties', {
													method: 'POST',
													body: content[i].value,
													headers: {
														'Slug': content[i].name,
														'x-deki-token': this.keys[subdomain],
														'x-requested-with': 'XMLHttpRequest',
													},
												}).then();
											}
											break;
										//subpageListing check
										case 'mindtouch.idf#guideDisplay':
											if (tags.includes('article:topic-guide')) {
												fetch('/@api/deki/pages/=' + encodeURIComponent(encodeURIComponent(path)) + '/properties', {
													method: 'POST',
													body: content[i].value,
													headers: {
														'Slug': content[i].name,
														'x-deki-token': this.keys[subdomain],
														'x-requested-with': 'XMLHttpRequest',
													},
												}).then();
											}
											break;
										//pagecontent
										case 'mindtouch.page#overview':
										case 'mindtouch#idf.guideTabs':
										case 'mindtouch.page#welcomeHidden':
										case 'mindtouch.idf#product-image': //NEED FILE TRANSFER
											fetch('/@api/deki/pages/=' + encodeURIComponent(encodeURIComponent(path)) + '/properties', {
												method: 'POST',
												body: content[i].value,
												headers: {
													'Slug': content[i].name,
													'x-deki-token': this.keys[subdomain],
													'x-requested-with': 'XMLHttpRequest',
												},
											}).then();
											break;
									}
								}
							});
							
							// Title cleanup
							if (child.data.padded) {
								fetch('/@api/deki/pages/=' + encodeURIComponent(encodeURIComponent(path)) + '/move?title=' + child.title + '&name=' + child.data.padded, {
									method: 'POST',
									headers: {
										'x-deki-token': this.keys[subdomain],
										'x-requested-with': 'XMLHttpRequest',
									},
								}).then();
							}
							
							//Thumbnail
							LibreTexts.authenticatedFetch(child.path, 'files', child.data.subdomain).then(async (response) => {
								if (response.ok) {
									let files = await response.text();
									if (files.includes('mindtouch.page#thumbnail') || files.includes('mindtouch.page%23thumbnail')) {
										let image = await LibreTexts.authenticatedFetch(child.path, 'thumbnail', child.data.subdomain);
										
										image = await image.blob();
										fetch('/@api/deki/pages/=' + encodeURIComponent(encodeURIComponent(path)) + '/files/=mindtouch.page%2523thumbnail', {
											method: 'PUT',
											body: image,
											headers: {
												'x-deki-token': this.keys[subdomain],
												'x-requested-with': 'XMLHttpRequest',
											},
										}).then();
									}
									else if (tags.includes('article:topic-category') || tags.includes('article:topic-guide')) {
										let current = window.location.origin.split('/')[2].split('.')[0];
										let image = await fetch('https://chem.libretexts.org/@api/deki/files/239314/default.png?origin=mt-web', {
											headers: {
												'x-deki-token': this.keys['chem'],
												'x-requested-with': current === 'chem' ? 'XMLHttpRequest' : '',
											},
										});
										
										image = await image.blob();
										fetch('/@api/deki/pages/=' + encodeURIComponent(encodeURIComponent(path)) + '/files/=mindtouch.page%2523thumbnail', {
											method: 'PUT',
											body: image,
											headers: {
												'x-deki-token': this.keys[subdomain],
												'x-requested-with': 'XMLHttpRequest',
											},
										}).then();
									}
								}
							});
					}
				}
			}*/
		}
		
		
		async function processFile(file, child, path, id) {
			let image, filename;
			if (!file) {
				image = await fetch(`https://${child.data.subdomain}.libretexts.org/@api/deki/files/${id}?dream.out.format=json`, {
					headers: {'x-deki-token': this.keys[child.data.subdomain]},
				});
				filename = await fetch(`https://${child.data.subdomain}.libretexts.org/@api/deki/files/${id}/info?dream.out.format=json`, {
					headers: {'x-deki-token': this.keys[child.data.subdomain]},
				});
				if (!image.ok || !filename.ok)
					return false;
				filename = await filename.json();
				filename = filename['filename'];
				
			}
			else if (!(file.contents['@href'].includes('mindtouch.page#thumbnail') || file.contents['@href'].includes('mindtouch.page%23thumbnail'))) {
				//only files with extensions
				filename = file['filename'];
				image = await LibreTexts.authenticatedFetch(child.path, `files/${filename}`, child.data.subdomain);
				if (!image.ok)
					return false;
			}
			
			
			if (filename) {
				image = await image.blob();
				
				let response = await fetch(`/@api/deki/pages/=${encodeURIComponent(encodeURIComponent(path))}/files/${filename}?dream.out.format=json`, {
					method: 'PUT',
					body: image,
					headers: {'x-deki-token': this.keys[subdomain], 'x-requested-with': 'XMLHttpRequest'},
				});
				if (!response.ok)
					return false;
				
				response = await response.json();
				let original = file ? file.contents['@href'].replace(`https://${child.data.subdomain}.libretexts.org`, '') : `/@api/deki/files/${id}`;
				return {
					original: original,
					oldID: id,
					newID: response['@id'],
					final: `/@api/deki/pages/=${encodeURIComponent(encodeURIComponent(path))}/files/${filename}`,
				};
			}
			return false;
		}
		
		async function putProperty(name, value, path) {
			await LibreTexts.authenticatedFetch(path, 'properties', null, {
				method: 'POST',
				body: value,
				headers: {
					'Slug': name,
				},
			});
		}
	};
	
}

function checkStructure(type, parentType) {
	if (!type || !parentType)
		return false;
	switch (type) {
		case 'topic-category':
			return !(parentType === 'topic-category');
		case 'topic-guide':
			return !(parentType === 'topic-category');
		case 'topic':
			return !(parentType !== 'topic-category');
		default:
			return false;
	}
}


function secondsToStr(seconds) {
	return millisecondsToStr(seconds * 1000);
	
	// http://stackoverflow.com/a/8212878
	function millisecondsToStr(milliseconds) {
		// TIP: to find current time in milliseconds, use:
		// var  current_time_milliseconds = new Date().getTime();
		
		function numberEnding(number) {
			return (number > 1) ? 's' : '';
		}
		
		let temp = Math.floor(milliseconds / 1000);
		const years = Math.floor(temp / 31536000);
		if (years) {
			return years + ' year' + numberEnding(years);
		}
		const days = Math.floor((temp %= 31536000) / 86400);
		if (days) {
			return days + ' day' + numberEnding(days);
		}
		const hours = Math.floor((temp %= 86400) / 3600);
		if (hours) {
			return hours + ' hour' + numberEnding(hours);
		}
		const minutes = Math.floor((temp %= 3600) / 60);
		if (minutes) {
			return minutes + ' minute' + numberEnding(minutes);
		}
		const seconds = temp % 60;
		if (seconds) {
			return seconds + ' second' + numberEnding(seconds);
		}
		return 'less than a second'; //'just now' //or other string you like;
	}
}

function formatNumber(it) {
	return it.toPrecision(4);
}