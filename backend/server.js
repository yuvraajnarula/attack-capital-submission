require('dotenv').config()
const express = require('express')
const {
    toNodeHandler
} = require('better-auth/node');

const port = process.env.PORT;

const app = express()

app.use(express.json());
app.listen(port, () => {
    console.log(`app listening on port ${port}`);
});
