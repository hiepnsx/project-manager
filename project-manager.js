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

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));



// Github Handler
function githubHandler(req, res) {
  console.log('got Github event!\n');
  handler(req, res, function () {
    res.statusCode = 404;
    res.end('VERVE: Github Handler!');
  })
}

handler.on('project_card', function (event) {
  // console.log(event);
})

function end(res) {
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('END!\n')
}

// Chatwork Handler
function chatworkHandler(projectName, req, res) {
  console.log('got Chatwork event!\n');
  if (req.method !== 'POST') {
    res.statusCode = 404;
    res.end('VERVE: Chatwork Handler!');
    return;
  }

  const project = findObjByField(config.projects, 'projectName', projectName);
  if (!project) {
    res.statusCode = 404;
    console.log('Project: ' + projectName + ' not in support list!');
    res.end('Project: ' + projectName + ' not in support list!');
    return;
  }

  let resultString = '';
  req.on('data', function (data) {
    resultString += data;
  })

  req.on('end', function () {
    const result = JSON.parse(resultString)
    // console.log(result.webhook_event);
    const taskContent = result.webhook_event.body

    if (TASK_REGEX.test(taskContent) !== true) {
      console.log("Message isn't task!\n" + taskContent)
      return end(res);
    }

    const taskArr         = TASK_REGEX.exec(taskContent),
          assigneeID      = taskArr[1],
          requestContent  = taskArr[3],
          deadlineDate    = new Date(taskArr[2]*1000),
          deadline = deadlineDate.getFullYear() + "/" +  (deadlineDate.getMonth() + 1) + "/"+ deadlineDate.getDate()  + "/" + deadlineDate.getDay();

    console.log("assigneeID: " + assigneeID);
    const user = findObjByField(config.users, 'chatworkID', assigneeID);

    if (!requestContent.trim()) {
      console.log("Message empty!")
      return end(res);
    }

    const messages      = requestContent.split('\n'),
          patternType   = messages[0],
          issueName     = messages[1],
          issueOverview = messages.slice(2).join("\n"),
          pattern       = findObjByField(config.pattern, 'type', patternType);

    if (!pattern) {
      console.log("Message pattern isn't supported!\n" + patternType)
      return end(res);
    }

    const issueTemplate = fs.readFileSync(pattern.template, 'utf8');
    const issueContent = issueTemplate.replace(/__OVERVIEW__/g, issueOverview)
                                      .replace(/__DEADLINE__/g, deadline);

    octokit.issues.create({
      owner: project.owner,
      repo: project.projectName,
      title: issueName,
      body: issueContent,
      assignee: user.githubID,
      labels: [pattern.type]
    }).then(issRes => {
      console.log(issRes.data.id);
      octokit.projects.createProjectCard({column_id: project.confirmColumnID, content_id: issRes.data.id, content_type: "Issue"}).then(cardRes => {
        console.log(cardRes);
      })

    })

  })

}

https.createServer(
  {
    key: fs.readFileSync(process.env.KEY),
    cert: [fs.readFileSync(process.env.CERT)],
    ca: [fs.readFileSync(process.env.CHAIN), fs.readFileSync(process.env.FULL_CHAIN)]
  },
  (req, res) => {
    const requestURL = url.parse(req.url, true);
    switch(requestURL.pathname) {
      case process.env.GITHUB_WH_URL:
        githubHandler(req, res);
        break;
      case process.env.CHATWORK_WH_URL:
        chatworkHandler(requestURL.query.project, req, res);
        break;
      default:
        console.log("Unhandled event! Request: " + req.pathname);
        res.statusCode = 404;
        res.end('VERVE INSIDE!');
    }

  }).listen(process.env.PORT);

