require('dotenv').config()
const express = require('express')
const {
    toNodeHandler
} = require('better-auth/node');

const port = process.env.PORT;
const router = require('./routes/index');

const app = express()

app.use(express.json());
app.use('/api/v1',router);
app.listen(port, () => {
    console.log(`app listening on port ${port}`);
});
