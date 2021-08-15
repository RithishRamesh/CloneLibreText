"use strict";
window.addEventListener("load", () => {
    buildManager();
});
async function storeReference(data, ID) {
    const Cite = CitRequire('citation-js');
    const Data = new Cite(data);
    const reference = Data.format('data');
    const citation = Data.format('citation');
    const parseReference = JSON.parse(reference);
    let Log = [];
    let referenceGlobal = {
        "id": parseReference[0].id,
        "citation": citation,
        "data": data
    };
    let referenceLocal = {
        "id": parseReference[0].id,
        "citation": citation
    };
    if (localStorage.getItem("book-references") !== null) {
        let Logged = localStorage.getItem("book-references");
        Logged = JSON.parse(Logged);
        Logged.push(referenceLocal);
        localStorage.setItem("book-references", JSON.stringify(Logged));
    }
    else {
        Log.push(referenceLocal);
        localStorage.setItem("book-references", JSON.stringify(Log));
    }
    let userRefJSON;
    try {
        userRefJSON = await LibreTexts.authenticatedFetch(null, `files/=${ID}references.json`, null);
        userRefJSON = await userRefJSON.json();
    }
    catch (e) {
        console.log(e);
        userRefJSON = [];
    }
    userRefJSON.push(referenceGlobal);
    await LibreTexts.authenticatedFetch(null, `files/=${ID}references.json`, null, {
        method: "PUT",
        body: (JSON.stringify(userRefJSON))
    });
    updateManager(referenceLocal);
    alert("object cited");
}
function deleteReference() {
    this.remove();
    // @TODO remove local-storage obj
}
function buildManager() {
    const managerArea = document.createElement('div');
    const pageID = $("#pageIDHolder").text();
    const managerData = `<input type="text" id="referenceInput-Text" value=""> <button onclick="storeReference(document.getElementById('referenceInput-Text').value, ${pageID})">Cite</button>`;
    const referenceArea = document.createElement('ul');
    referenceArea.id = 'referenceDisplay';
    managerArea.id = 'referenceInput';
    managerArea.innerHTML = managerData;
    document.getElementById("pageText").append(managerArea);
    document.getElementById("pageText").append(referenceArea);
    updateManagerRefresh();
}
function updateManager(elem) {
    let item = document.createElement("li");
    item.onclick = deleteReference;
    item.innerText = "ID# " + elem.id + "\n" + "Citation:  " + elem.citation;
    document.getElementById('referenceDisplay').appendChild(item);
}
function updateManagerRefresh(ref = JSON.parse(localStorage.getItem("book-references"))) {
    let render = localStorage.getItem("book-references");
    if (render != null) {
        render = JSON.parse(render);
        //@ts-ignore
        render.forEach((element) => {
            let item = document.createElement("li");
            item.onclick = deleteReference;
            item.innerText = "ID# " + element.id + "\n" + "Citation:  " + element.citation;
            document.getElementById('referenceDisplay').appendChild(item);
        });
    }
    else {
        return null;
    }
}
