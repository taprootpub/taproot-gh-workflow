const core = require('@actions/core');
const { Octokit } = require('@octokit/rest');
const github = require('@actions/github');
const { dealStringToArr } = require('actions-util');

// **********************************************************
const token = core.getInput('token');
const octokit = new Octokit({ auth: `token ${token}` });
const context = github.context;

const outEventErr = `This Action only supports the "push" event.`;

async function run() {
  try {
    const { owner, repo } = context.repo;
    if (context.eventName === 'push') {
      const message = context.head_commit.message;

      let issues = [];
      let arr = message.split(' ');
      arr.forEach(it => {
        if (it.startsWith('#')) {
          issues.push(it.replace('#', ''));
        }
      });

      core.info(`[Action: Query Issues][${issues}]`);
      core.setOutput('issues', issues);

      const addLabels = core.getInput('add-labels');
      const removeLabelsString = core.getInput('remove-labels');
      const removeLabels = dealStringToArr(removeLabelsString);

      if (!addLabels) {
        return false;
      }

      for await (const issue of issues) {
        if (addLabels) {
          await octokit.issues.addLabels({
            owner,
            repo,
            issue_number: issue,
            labels: dealStringToArr(addLabels),
          });
          core.info(`Actions: [add-labels][${issue}][${addLabels}] success!`);
        }
        if (removeLabels && removeLabels.length) {
          const issueInfo = await octokit.issues.get({
            owner,
            repo,
            issue_number: issue,
          });
          const baseLabels = issueInfo.data.labels.map(({ name }) => name);
          const removes = baseLabels.filter(name => removeLabels.includes(name));
          for (const label of removes) {
            await octokit.issues.removeLabel({
              owner,
              repo,
              issue_number: issue,
              name: label,
            });
            core.info(`Actions: [remove-label][${issue}][${label}] success!`);
          }
        }
      }
    } else {
      core.setFailed(outEventErr);
    }
    core.info(`Taproot GitHub Workflow finished!`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
