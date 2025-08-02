const selfField = ["text", "markdown", "table", "json", "error", "file"];
const typeField = { image: "url", audio: "url", video: "url" };

const content = Object.fromEntries([
  ...selfField.map((k) => [k, (x) => ({ type: k, [k]: x })]),
  ...Object.entries(typeField).map(([k, v]) => [
    k,
    (x) => ({ type: k, [v]: x }),
  ]),
]);

export default content;
