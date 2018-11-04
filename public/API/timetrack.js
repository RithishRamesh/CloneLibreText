if (!window["timeTrack"]) {
	window["timeTrack"] = true;
	track();

	function track() {
		let hidden, state, visibilityChange;
		let username = document.getElementById("userEmailHolder").innerText;

		if (document.hidden != null) {
			hidden = "hidden";
			visibilityChange = "visibilitychange";
			state = "visibilityState";
		}
		else if (document.mozHidden != null) {
			hidden = "mozHidden";
			visibilityChange = "mozvisibilitychange";
			state = "mozVisibilityState";
		}
		else if (document.msHidden != null) {
			hidden = "msHidden";
			visibilityChange = "msvisibilitychange";
			state = "msVisibilityState";
		}
		else if (document.webkitHidden != null) {
			hidden = "webkitHidden";
			visibilityChange = "webkitvisibilitychange";
			state = "webkitVisibilityState";
		}

		let start = new Date();
		let end = new Date();
		let Estart = new Date(); //for editor times
		let Eend = new Date();
		let prevfocus = false;
		let editorOpen = false;

// Calculates Time Spent on page upon switching windows

		setInterval((function () {
			if (document.hasFocus() === false && prevfocus) {
				prevfocus = false;
				end = new Date();
				Eend = new Date();
				const time_spent = Math.round((end - start) / 1000);
				reportInterval("Switched Window", time_spent, false);

				if (Estart !== -1) {
					const edit_time = Math.round((Eend - Estart) / 1000);
					reportInterval("Switched Window", edit_time, true);
				}
			}
			else if (document.hasFocus() === true && !prevfocus) {
				start = new Date();
				prevfocus = true;
				Estart = isEditorOpen() ? new Date() : -1;
			}
			else if (isEditorOpen() && Estart === -1) {
				Estart = new Date();
			}
		}), 200);

// Calculates Time Spent on page upon leaving/closing page

		window.addEventListener('beforeunload', function () {
			end = new Date();
			var time_spent = Math.round((end - start) / 1000);
			if (time_spent > 1) {
				var data = JSON.stringify({
					messageType: "Activity",
					message: "[Left Page]",
					activeTime: time_spent,
					editorOpen: editorOpen,
					timestamp: new Date(),
					username: username
				});
				$.ajax({
					type: "PUT",
					async: false,
					url: "https://computer.miniland1333.com/receive",
					data: JSON.stringify(data)
				});
				if (editorOpen) {
					$.ajax({
						type: "PUT",
						async: false,
						url: "https://computer.miniland1333.com/receive",
						data: JSON.stringify(data)
					});
				}
			}
		});

// Calculates Time Spent on page upon unfocusing tab
// http://davidwalsh.name/page-visibility

		/*		document.addEventListener(visibilityChange, (function (e) {
					if (document[state] === 'visible') {
						start = new Date();
					}
					else if (document[hidden]) {
						end = new Date();
						const time_spent = Math.round((end - start) / 1000);
						reportInterval("Changed Tab", time_spent);
					}
				}), false);*/

// Function that does something
		function isEditorOpen() {
			return document.getElementById("eareaParent");
		}

		inactive();

		function inactive() {
			let t;
			let inactiveStart = -1;

			function resetTimer() {
				//Report inactivity
				let inactiveEnd = new Date();
				if (inactiveStart !== -1) {
					let inactiveTime = inactiveEnd - inactiveStart;
					fetch("https://computer.miniland1333.com/receive", {
						method: "PUT",
						body: JSON.stringify({
							messageType: "Inactivity",
							inactiveTime: inactiveTime,
							timestamp: new Date(),
							username: username
						})
					}).then();
				}

				clearTimeout(t);
				inactiveStart = -1; //reset start
				t = setTimeout(function () {
					inactiveStart = new Date(); //set start
					console.log(inactiveStart);
				}, 10000);
			}

			window.onload = resetTimer;
			// DOM Events
			document.onmousemove = resetTimer;
			document.onkeypress = resetTimer;
		}

		function reportInterval(message, time_spent, editorOpen) {
			if (time_spent > 1) {
				fetch("https://computer.miniland1333.com/receive", {
					method: "PUT",
					body: JSON.stringify({
						messageType: "Activity",
						message: "[" + message + "]",
						activeTime: time_spent,
						editorOpen: editorOpen,
						timestamp: new Date(),
						username: username
					})
				}).then();
			}
		}
	}
}
