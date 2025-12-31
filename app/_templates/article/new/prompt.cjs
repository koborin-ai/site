// Helper function to convert title to slug
const toSlug = (str) =>
  str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .trim();

module.exports = {
  prompt: ({ inquirer }) => {
    return inquirer
      .prompt([
        {
          type: "list",
          name: "lang",
          message: "What language will you write this article in?",
          choices: [
            { name: "Japanese", value: "ja" },
            { name: "English", value: "en" },
          ],
        },
        {
          type: "list",
          name: "category",
          message: "Which category?",
          choices: [
            { name: "Tech - Technical articles", value: "tech" },
            { name: "Life - Lifestyle, hobbies", value: "life" },
          ],
        },
        {
          type: "input",
          name: "title",
          message: "Article title?",
          validate: (input) => (input ? true : "Title is required"),
        },
        {
          type: "input",
          name: "description",
          message: "Brief description (one sentence)?",
          validate: (input) => (input ? true : "Description is required"),
        },
      ])
      .then((answers) => {
        const slug = toSlug(answers.title);
        const langPath = answers.lang === "ja" ? "ja/" : "";
        const filePath = `src/content/docs/${langPath}${answers.category}/${slug}.mdx`;

        return {
          ...answers,
          slug,
          langPath,
          filePath,
        };
      });
  },
};
