// 记下右键点到的元素：Instagram、小红书的图上盖着透明层，浏览器给不出图片地址，要靠这个位置去找真正的图。
document.addEventListener(
  "contextmenu",
  (event) => {
    globalThis.__momentoContextTarget = { element: event.target, time: Date.now() };
  },
  true
);
