require('dotenv').config();

const TASK_REGEX = /^\[info]\[title]\[dtext:task_added]\[\/title]\[task aid=(.*) st=open lt=([0-9]+)](.*)\[\/task]\[\/info]$/

const https                 = require('https'),
      fs                    = require('fs'),
      createHandler         = require('github-webhook-handler'),
      octokit               = require('@octokit/rest')({debug: process.env.NODE_ENV === "production"}),
      handler               = createHandler({ path: process.env.GITHUB_WH_URL, secret: process.env.GITHUB_SECRET })

// Disable all console.log in production
if(process.env.NODE_ENV === "production") {
  console.log = function(){};
}

// Github Auth
octokit.authenticate({
  type: 'token',
  token: process.env.GITHUB_TOKEN
})


// Github Handler
function githubHandler(req, res) {
  handler(req, res, function () {
    res.statusCode = 404;
    res.end('VERVE: Github Handler!');
  })
}

handler.on('project_card', function (event) {
  console.log(event);
})

// Chatwork Handler
function chatworkHandler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 404;
    res.end('VERVE: Chatwork Handler!');
  }
  let resultString = '';
  req.on('data', function (data) {
    resultString += data;
  })

  req.on('end', function () {
    let result = JSON.parse(resultString);
    console.log(result.webhook_event);
    const message = result.webhook_event.body;
    if (TASK_REGEX.test(message) === true) {
      let matches = TASK_REGEX.exec(message);
      octokit.projects.createProjectCard({column_id: 2348257, note: matches[3]}).then(res => {

      })
    }
    res.writeHead(200, {'Content-Type': 'text/plain'})
    res.end('Success!\n')
  })

}

https.createServer(
  {
    key: fs.readFileSync(process.env.KEY),
    cert: [fs.readFileSync(process.env.CERT)],
    ca: [fs.readFileSync(process.env.CHAIN), fs.readFileSync(process.env.FULL_CHAIN)]
  },
  (req, res) => {
    switch(req.url) {
      case process.env.GITHUB_WH_URL:
        githubHandler(req, res);
        break;
      case process.env.CHATWORK_WH_URL:
        chatworkHandler(req, res);
        break;
      default:
        res.statusCode = 404;
        res.end('VERVE INSIDE!');
    }

  }).listen(process.env.PORT);

