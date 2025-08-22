// info.js

document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll(".info-section");
  const titles = document.querySelectorAll(".section-title");

  function updateActiveSection() {
    let index = sections.length;

    while (--index && window.scrollY + 200 < sections[index].offsetTop) {}

    titles.forEach(title => title.classList.remove("active"));
    if (titles[index]) {
      titles[index].classList.add("active");
    }
  }

  updateActiveSection();
  window.addEventListener("scroll", updateActiveSection);
});
