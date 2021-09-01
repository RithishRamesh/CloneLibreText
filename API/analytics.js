const timestamp = require("console-timestamp");
const fs = require("fs-extra");
const crypto = require('crypto');
const secure = require('./secure.json');
const express = require('express');
const app = express();
const cors = require('cors');
// app.use(cors());
app.use(express.text());
const async = require('async');

//middleware configuration and initialization
const basePath = '/ay';
// app.use(express.static('analyticsSecure'));
let port = 3004;
if (process.argv.length >= 3 && parseInt(process.argv[2])) {
    port = parseInt(process.argv[2]);
}
app.listen(port, () => {
    const now1 = new Date();
    console.log(`Restarted ${timestamp('MM/DD hh:mm', now1)} ${port}`);
});

app.get(basePath + '/ping', (req, res) => {
    res.send('PONG');
});

app.post(basePath + '/receive', async (req, res) => {
    res.send('Done');
    // res.status(200).end();
    // console.log(req.body);
    if (!(req.headers.origin && req.headers.origin.endsWith("libretexts.org"))) {
        return res.status(400).end();
    }
    
    let body = req.body;
    try {
        let date = new Date();
        let event = JSON.parse(body);
        let courseName = event.actor.courseName;
        
        let user = event.actor.id.user || event.actor.id;
        if (!courseName || !user)
            return false;
        
        const cipher = crypto.createCipheriv('aes-256-cbc', secure.analyticsSecure, Buffer.from(secure.analyticsSecure, 'hex'));
        
        user = cipher.update(user, 'utf8', 'hex')
        user += cipher.final('hex');
        event.actor.id = user;
        body = JSON.stringify(event);
        
        const datePath = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
        
        if (courseName) {
            if (!Array.isArray(courseName))
                courseName = [courseName];
            for (let i = 0; i < courseName.length; i++) {
                await fs.ensureDir(`./analyticsData/ay-${courseName[i]}/${datePath}`);
                await fs.appendFile(`./analyticsData/ay-${courseName[i]}/${datePath}/${user}.txt`, body + "\n");
                await fs.appendFile(`./analyticsData/ay-${courseName[i]}/${user}.txt`, body + "\n");
            }
        }
    } catch (e) {
        console.error(e);
    }
})

app.get(basePath + '/listCourses', async (req, res) => {
    let courses = await fs.readdir(`./analyticsData/`);
    courses = courses.filter(e => e.startsWith('ay'));
    res.send(courses);
})

app.post(basePath + '/secureAccess', express.urlencoded({extended: true}), async (req, res) => {
    let auth = req.body.tokenField;
    if (!auth) {
        return res.sendStatus(401);
    }
    else if (auth !== secure.analyticsREST) {
        return res.sendStatus(403);
    }
    
    let courseName = req.body.courseName;
    if (courseName) {
        // courseName = `ay-${courseName}`;
        if (!await fs.exists(`./analyticsData/${courseName}`)) {
            return res.status(404).send({error: `Could not find course ${courseName}`});
        }
        await prepareZipData(courseName);
        await streamZip(courseName, res)
    }
});

app.post(basePath + '/getLinker', express.urlencoded({extended: true}), async (req, res) => {
    let auth = req.body.tokenField;
    if (!auth) {
        return res.sendStatus(401);
    }
    else if (auth !== secure.analyticsREST) {
        return res.sendStatus(403);
    }
    
    let courseName = req.body.courseName;
    if (courseName) {
        // courseName = `ay-${courseName}`;
        if (!await fs.exists(`./analyticsData/${courseName}`)) {
            return res.status(404).send({error: `Could not find course ${courseName}`});
        }
        await createLinker(courseName, res);
    }
});

async function prepareZipData(courseName) {
    await fs.emptyDir(`./analyticsData/ZIP/${courseName}/RAW`);
    await fs.emptyDir(`./analyticsData/ZIP/${courseName}/CSV`);
    console.time('copy');
    await fs.copy(`./analyticsData/${courseName}`, `./analyticsData/ZIP/${courseName}/RAW`);
    console.timeEnd('copy');
    
    console.log(`Beginning ${courseName}`);
    //Reprocessing raw data
    let months = await fs.readdir(`./analyticsData/ZIP/${courseName}/RAW`, {withFileTypes: true});
    months = months.filter(m => m.isDirectory());
    
    console.time('Reprocessing');
    for (let month of months) {
        console.log(month.name);
        let students = await fs.readdir(`./analyticsData/ZIP/${courseName}/RAW/${month.name}`, {withFileTypes: true});
        await async.eachLimit(students, 25, async (student) => {
            if (student.isFile()) {
                student = student.name;
                const fileRoot = student.replace('.txt', '');
                let lines = await fs.readFile(`./analyticsData/ZIP/${courseName}/RAW/${month.name}/${student}`);
                lines = lines.toString().replace(/\n$/, "").split('\n');
                lines = lines.map((line) => {
                    try {
                        return JSON.parse(line);
                    } catch (e) {
                        console.error(`Invalid: ${line}`, e);
                        return undefined;
                    }
                });
                let result = lines;
                let resultCSV = 'courseName## id## platform## verb## pageURL## pageID## timestamp## pageSession## timeMe## beeline_status## [type or percent]';
                
                //CSV Handling
                for (let k = 0; k < result.length; k++) {
                    let line = lines[k];
                    if (!line) {
                        continue;
                    }
                    resultCSV += `\n${line.actor.courseName}##${line.actor.id}##${line.actor.platform || 'undefined'}##${line.verb}##${line.object.url}##${line.object.id}##"${line.object.timestamp}"##${line.object.pageSession}##${line.object.timeMe}}##${line.object.beeline}`;
                    switch (line.verb) {
                        case 'left':
                            resultCSV += `##${line.type}`;
                            break;
                        case 'read':
                            resultCSV += `##${line.result.percent}`;
                            break;
                        case 'answerReveal':
                            resultCSV += `##${line.result.answer}`;
                            break;
                    }
                    
                }
                resultCSV = resultCSV.replace(/,/g, '%2C');
                resultCSV = resultCSV.replace(/##/g, ',');
                
                await fs.appendFile(`./analyticsData/ZIP/${courseName}/CSV/${fileRoot}.csv`, resultCSV);
            }
        })
    }
    console.timeEnd('Reprocessing');
}

async function streamZip(courseName, res) {
    const archiver = require('archiver');
    const archive = archiver('zip');
    
    console.time('Compressing');
    
    archive.on('error', function (err) {
        res.status(500).send({error: err.message});
    });
    
    //on stream closed we can end the request
    archive.on('end', function () {
        console.log('Archive wrote %d bytes', archive.pointer());
    });
    
    //set the archive name
    res.attachment(`secureAccess-${courseName}.zip`);
    
    //this is the streaming magic
    archive.pipe(res);
    
    let months = await fs.readdir(`./analyticsData/ZIP/${courseName}`, {withFileTypes: true});
    months = months.filter(m => m.isDirectory());
    
    for (const dir of months) {
        console.log(dir.name);
        await archive.directory(`./analyticsData/ZIP/${courseName}/${dir.name}`, dir.name);
    }
    
    await archive.finalize();
    
    console.timeEnd('Compressing');
    await fs.ensureDir('./analyticsSecure');
    
    await fs.emptyDir(`./analyticsData/ZIP/${courseName}`);
    console.log(`Secure Access ${courseName}`);
}

//createLinker('chem-2737')

async function createLinker(courseName, res) {
    let students = await fs.readdir(`./analyticsData/${courseName}`, {withFileTypes: true});
    let output = 'Identifier, Email\n';
    for (const studentsKey of students) {
        if (studentsKey.isFile()) {
            const user = studentsKey.name.replace('.txt', '');
            
            const decipher = crypto.createDecipheriv('aes-256-cbc', secure.analyticsSecure, Buffer.from(secure.analyticsSecure, 'hex'));
            let user2 = decipher.update(Buffer.from(user, 'hex'))
            user2 += decipher.final('utf8');
            
            // console.log(user2);
            output += `${user}, ${user2}\n`;
        }
    }
    // console.log(output);
    res.attachment(`secureAccess-linker-${courseName}.csv`);
    res.set('Content-Type', 'text/csv');
    res.send(output)
}
