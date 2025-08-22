// info.js
document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll(".info-section");
  const dynamicTitle = document.getElementById("dynamic-title");

  function updateTitle() {
    let index = sections.length;
    while (--index && window.scrollY + 200 < sections[index].offsetTop) {}

    const newTitle = sections[index].getAttribute("data-title");
    if (dynamicTitle.textContent !== newTitle) {
      dynamicTitle.classList.remove("fade-in");
      dynamicTitle.classList.add("fade-out");

      setTimeout(() => {
        dynamicTitle.textContent = newTitle;
        dynamicTitle.classList.remove("fade-out");
        dynamicTitle.classList.add("fade-in");
      }, 300); // matches CSS transition
    }
  }

  updateTitle();
  window.addEventListener("scroll", updateTitle);
});
