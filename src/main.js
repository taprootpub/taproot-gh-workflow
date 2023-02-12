const core = require('@actions/core');
const { Octokit } = require('@octokit/rest');
const github = require('@actions/github');
const { dealStringToArr } = require('actions-util');

// **********************************************************
const token = core.getInput('token');
const commit_prefixes = core.getInput('commit_prefixes');
const prefix_labels = core.getInput('prefix_labels');
const close_label = core.getInput('close_label');
const octokit = new Octokit({ auth: `token ${token}` });
const context = github.context;

const outEventErr = `This Action only supports the "push" event.`;

async function run() {
  try {
    const { owner, repo } = context.repo;
    if (context.eventName === 'push') {
      const commits = context.payload.commits;
      const prefixes = commit_prefixes.split(';');

      for (const commit of commits) {
        core.info(`[Action: Commit][${commit.message}]`);

        let issues = [];
        let users = [];
        let addLabels = '';
        let removeLabelsString = '';

        if (prefixes.some(prefix => commit.message.toLowerCase().startsWith(prefix.trim()))) {
          let arr = commit.message.split(' ');
          arr.forEach(it => {
            if (it.startsWith('#')) {
              issues.push(it.replace('#', ''));
            } else if(it.startsWith('@')) {
              users.push(it.replace('@', ''));
            }
          });

          core.info(`[Action: Query Issues][${issues}]`);

          for (let i = 0; i < prefixes.length; i++) {
            if (commit.message.toLowerCase().startsWith(prefixes[i].trim())) {
              addLabels = prefix_labels.split(';')[i].trim();
              removeLabelsString = prefix_labels
                .split(';')
                .filter((_, index) => index != i)
                .join(',');
              break;
            }
          }

          if (issues.length > 0) {
            const removeLabels = dealStringToArr(removeLabelsString);

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
              if (addLabels == close_label) {
                await octokit.issues.update({
                  owner,
                  repo,
                  issue_number: issue,
                  state: 'closed',
                });
                core.info(`Actions: [close-issue][${issue}] success!`);
              } else {
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
              if (users.length > 0) {
                await octokit.issues.update({
                  owner,
                  repo,
                  issue_number: issue,
                  assignees: users
                });
                core.info(`Actions: [assign-users][${issue}][${users}] success!`);
              }
            }
          } else {
            core.info(`Actions: [no-issue]`);
          }
        } else {
          continue;
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
