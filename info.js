document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll(".info-content section");
  const labels = document.querySelectorAll(".info-nav span");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          labels.forEach((label) => label.classList.remove("active"));
          const index = Array.from(sections).indexOf(entry.target);
          labels[index].classList.add("active");
        }
      });
    },
    { threshold: 0.5 }
  );

  sections.forEach((section) => observer.observe(section));
});
