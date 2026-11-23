// 扩展自己的语言选择。Chrome 自带的 i18n 只认浏览器界面语言（Dia 这类浏览器只报 en），
// 用户在设置里选了语言，就直接读那个语言的 _locales 文案。后台和设置页共用。

const MOMENTO_LANGUAGES = ["auto", "zh_CN", "en", "ja"];
let momentoMessages = null;
// 连着切了几次语言时，只认最后一次读的结果，免得慢一步读完的旧语言盖掉新选的。
let momentoLoadCount = 0;

// 读设置里的语言并装好文案；「跟随浏览器」时用 Chrome 自带的。
async function momentoLoadLanguage() {
  const count = ++momentoLoadCount;
  const { language = "auto" } = await chrome.storage.local.get("language");
  if (language === "auto" || !MOMENTO_LANGUAGES.includes(language)) {
    if (count === momentoLoadCount) {
      momentoMessages = null;
    }
    return "auto";
  }
  const response = await fetch(chrome.runtime.getURL(`_locales/${language}/messages.json`));
  const messages = await response.json();
  if (count === momentoLoadCount) {
    momentoMessages = messages;
  }
  return language;
}

function t(key, ...substitutions) {
  const values = substitutions.map(String);
  if (!momentoMessages) {
    return chrome.i18n.getMessage(key, values) || key;
  }
  const message = momentoMessages[key]?.message;
  if (!message) {
    return key;
  }
  return message.replace(/\$(\d)/g, (match, n) => values[Number(n) - 1] ?? "");
}
