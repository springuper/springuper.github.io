var request = require('request');

request('http://www.10101111.com', function (error, response, body) {
    if (!error && response.statusCode == 200) {
        console.log(body) // Show the HTML for the Google homepage. 
    }
});

console.log('do other stuff');
