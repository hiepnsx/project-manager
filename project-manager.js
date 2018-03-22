require('dotenv').config();

const TASK_REGEX = /^\[info]\[title]\[dtext:task_added]\[\/title]\[task aid=(.*) st=open lt=([0-9]+)]([^]+)\[\/task]\[\/info]$/

// const MAPPING = [];

// const LABELS = ['開発依頼', '調査依頼', '見積もり依頼'];

// const PROJECTS = [
//   'laravel-test',
//   'thanksgift-app',
//   'KBU'
// ];


const https           = require('https'),
      url             = require('url'),
      fs              = require('fs'),
      createHandler   = require('github-webhook-handler'),
      octokit         = require('@octokit/rest')({debug: process.env.NODE_ENV === "production"}),
      handler         = createHandler({ path: process.env.GITHUB_WH_URL, secret: process.env.GITHUB_SECRET })

// Disable all console.log in production
if(process.env.NODE_ENV === "production") {
  console.log = function(){};
}

// Github Auth
octokit.authenticate({
  type: 'token',
  token: process.env.GITHUB_TOKEN
})

function findObjByField(arr, field, value) {
  return arr.find(obj => obj[field] === value);
}

const config = JSON.parse(fs.readFileSync('project_config.json', 'utf8'));
cons



// Github Handler
function githubHandler(project, req, res) {
  console.log('got Github event!\n');
  handler(req, res, function () {
    res.statusCode = 404;
    res.end('VERVE: Github Handler!');
  })
}

handler.on('project_card', function (event) {
  console.log(event);
})

// Chatwork Handler
function chatworkHandler(project, req, res) {
  console.log('got Chatwork event!\n');
  if (req.method !== 'POST') {
    res.statusCode = 404;
    res.end('VERVE: Chatwork Handler!');
    return;
  }

  if (!findObjByField(config, 'projectName', project)) {
    res.statusCode = 404;
    res.end('Project: ' + project + ' not in support list!');
    return;
  }

  let resultString = '';
  req.on('data', function (data) {
    resultString += data;
  })

  req.on('end', function () {
    let result = JSON.parse(resultString);
    // console.log(result.webhook_event);
    const taskContent = result.webhook_event.body;
    if (TASK_REGEX.test(taskContent) === true) {
      let requestContent = TASK_REGEX.exec(taskContent)[3];
      if (requestContent.trim()) {
        let messages = requestContent.split("\n");
        console.log(messages);
        // octokit.projects.createProjectCard({column_id: 2348257, note: matches[3]}).then(res => {
        //
        // })

        let issueTemplate = fs.readFileSync('development_request_template.md', 'utf8');

        octokit.issues.create({owner: "verve-inc", repo: "laravel-test", title: "タイトル", body: issueTemplate, assignee: "hiepnsx", labels: ["機能追加"]}).then(res => {

        })
      }
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
    const requestURL = url.parse(req.url);
    const project = requestURL.query.project;
    switch(requestURL.pathname) {
      case process.env.GITHUB_WH_URL:
        githubHandler(project, req, res);
        break;
      case process.env.CHATWORK_WH_URL:
        chatworkHandler(project, req, res);
        break;
      default:
        console.log("Unhandled event! Request: " + req.pathname);
        res.statusCode = 404;
        res.end('VERVE INSIDE!');
    }

  }).listen(process.env.PORT);

