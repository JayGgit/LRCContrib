const express = require("express");
const app = express();
const bodyParser = require('body-parser')
const path = require("path")
const axios = require('axios')
const crypto = require('crypto');
const { Worker } = require('worker_threads');
const os = require('os');
const {verify} = require('hcaptcha');


require('dotenv').config();
const genuisAPI = process.env.GENUISAPIKEY // For genius API use
const hCaptchaSecret = process.env.HCAPTCHA // For hCaptcha use

// Challenge solver

function verify_nonce(result, target) {
    if (result.length != target.length) return false;

    for (let i = 0; i < result.length - 1; i++) {
        if (result[i] > target[i]) return false;
        else if (result[i] < target[i]) break;
    }

    return true;
}

function solve(prefix, target_hex) {
    let nonce = 0;
    const target = Buffer.from(target_hex, 'hex');

    console.log('');
    while (true) {
        if (nonce % 100000 === 0)
            console.log(`Solver - Nonce (~100000): ${nonce}`);
        const input = `${prefix}${nonce}`;
        const hashed = crypto.createHash('sha256').update(input).digest();
        if (verify_nonce(hashed, target)) {
            break;
        } else {
            nonce++;
        }
    }

    return { nonce: nonce, prefix: prefix };
}

// Captcha validator

function validateCaptcha(token) {
    verify(hCaptchaSecret, token)
        .then((data) => {
        if (data.success === true) {
            return(true)
        } else {
            return(false)
        }
        })
        .catch(console.error);
}

// Start express server

const PORT = 8080;

// Public folder middleware
app.use(express.static(path.join(__dirname, 'public')));

// Landing Page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html'); // Sends index.html
});

app.get('/view', (req, res) => {
    res.sendFile(__dirname + '/public/view.html'); // Sends view.html
})

app.get('/api/search', async (req, res) => {
    try {
        const response = axios.get('https://api.genius.com/search', { // Start GET request to genius search api
            params: {
                q: req.query.query // Actual query
            },
            headers: {
                "Lrclib-Client": "LRCContrib v0.1.0a (https://github.com/JayGgit/LRCContrib)", // Not really needed for genius, but included anyways
                "Authorization": `Bearer ${genuisAPI}` // API token. Specified in .env as GENUISAPIKEY
            }
        })
        .then(data => {
            tempRes = []; // All songs get pushed onto this array
            if (data.data && data.data.response.hits.length > 0) { // If stuff actually exists
                for (i = 0; i < data.data.response.hits.length; i++) { // For each song found
                    const songInfo = data.data.response.hits[i].result; // Info for the current found song
                    tempRes.push({ // Push onto tempRes array as json for api use
                        "name": `${songInfo.title}`, // Song name
                        "artistName": `${songInfo.artist_names}`, // Artist name
                        "image": `${songInfo.song_art_image_url}`, // Image URL
                        "geniusID": `${songInfo.id}` // Image URL
                    })
                }
            }
            else {
                console.log('No song found'); // Womp Womp
                console.log(response.data)
            }
            res.send(tempRes) // Sends completed song list
        })
    } catch (error) {
        console.error('Error fetching song details:', error);
    }
})

app.get('/api/getId', (req, res) => {
    try {
        const response = axios.get('https://api.genius.com/songs/' + req.query.id, { // Start GET request to genius search api
            params: {
            },
            headers: {
                "Lrclib-Client": "LRCContrib v0.1.0a (https://github.com/JayGgit/LRCContrib)", // Not really needed for genius, but included anyways
                "Authorization": `Bearer ${genuisAPI}` // API token. Specified in .env as GENUISAPIKEY
            }
        })
        .then(data => {
            tempRes = []; // All songs get pushed onto this array // Outdated but too lazy to change cause copy pasted
            if (data.data) { // If stuff actually exists
                const songInfo = data.data.response.song; // Song info
                tempRes.push({ // Push onto tempRes array as json for api use
                    "name": `${songInfo.title}`, // Song name
                    "artistName": `${songInfo.artist_names}`, // Artist name
                    "image": `${songInfo.song_art_image_url}`, // Image URL
                    "geniusID": `${songInfo.id}` // Image URL
                })
            }
            else {
                console.log('No song found'); // Womp Womp
                console.log(response.data)
            }
            res.send(tempRes) // Sends completed song list
        })
    } catch (error) {
        console.error('Error fetching song details:', error);
    }
})

app.post('/api/getToken', bodyParser.text(), function (req, res) {
    console.log(req.body)
    if (validateCaptcha(req.body.token)) {
        console.log("valid")
        res.send(solve(req.query.prefix, req.query.target))
    } else {
        console.log("invalid")
        res.sendStatus(400)
    }
});

// 404 Not Found
app.use((req, res, next) => {
    res.status(404).send("404 - Not Found");
});

// Startup
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
