import dotenv from "dotenv";
dotenv.config();
const API_KEY = process.env.OPENAI_API_KEY;

async function cleanupAll() {
  let offset = 0;
  const limit = 100;
  let totalFetched;

  do {
    const url = new URL("https://api.openai.com/v1/assistants");
    url.searchParams.append("limit", limit);
    url.searchParams.append("offset", offset);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "openai-beta": "assistants=v2",
      },
    });

    const data = await res.json();

    if (!data.data || data.data.length === 0) break;

    totalFetched = data.data.length;

    for (const assistant of data.data) {
      await fetch(`https://api.openai.com/v1/assistants/${assistant.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "openai-beta": "assistants=v2",
        },
      });
      console.log(`Deleted assistant ${assistant.id}`);
    }

    offset += totalFetched;
  } while (totalFetched === limit);

  console.log("All assistants deleted.");
}

cleanupAll().catch(console.error);
