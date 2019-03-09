const fetch = require('node-fetch');

module.exports.slack = function (postName, postUrl) {
  const postData = {
    channel: process.env.SLACK_CHANNEL,
    text: `【${postName}】\n商品が入ったよ！急いでゲットだぜ！\n${postUrl}`,
  };
  fetch(process.env.SLACK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(postData),
  }).then(res => res.text()).then(console.log).catch(console.error);
}
