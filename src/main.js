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
      const commits = context.payload.commits;

      let issues = [];
      var addLabels = '';
      var removeLabelsString = '';

      for (const commit of commits) {
        const message = commit.message;

        if (message.toLowerCase().startsWith('wip') || message.toLowerCase().startsWith('rfe') || message.toLowerCase().startsWith('rtp') || message.toLowerCase().startsWith('pub')) {
          let arr = message.split(' ');
          arr.forEach(it => {
            if (it.startsWith('#')) {
              issues.push(it.replace('#', ''));
            }
          });

          core.info(`[Action: Query Issues][${issues}]`);
          core.setOutput('issues', issues);
        }

        if (message.toLowerCase().startsWith('wip')) {
          addLabels = 'in progress';
          removeLabelsString = 'idea, pursuing, ready for edit, ready to publish, published';
        } else if (message.toLowerCase().startsWith('rfe')) {
          addLabels = 'ready for edit';
          removeLabelsString = 'idea, pursuing, in progress, ready to publish, published';
        } else if (message.toLowerCase().startsWith('rtp')) {
          addLabels = 'ready to publish';
          removeLabelsString = 'idea, pursuing, in progress, ready for edit, published';
        } else if (message.toLowerCase().startsWith('pub')) {
          addLabels = 'published';
          removeLabelsString = 'idea, pursuing, in progress, ready for edit, ready to publish';
        }
      }
      
      if (issues.length > 0) {
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
          if (addLabels == 'published') {
            await octokit.issues.update({
              owner,
              repo,
              issue_number: issue,
              state: 'closed',
            });
            core.info(`Actions: [close-issue][${issue}] success!`);
          }
          else 
          {
            const issueInfo = await octokit.issues.get({
              owner,
              repo,
              issue_number: issue,
            });
            if (issueInfo.data.state == 'closed') {
              await octokit.issues.update({
                owner,
                repo,
                issue_number: issue,
                state: 'open',
              });
              core.info(`Actions: [open-issue][${issue}] success!`);
            }
          }
        }
      } else {
        core.info(`Actions: [no-issue]`);
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
