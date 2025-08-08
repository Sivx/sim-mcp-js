import { toolsJson, ChatAssistant, isMCP } from "../sim-mcp.js";

if (!isMCP()) {
  (async () => {
    const bot = new ChatAssistant();
    let final = await bot
      .chain()
      .yesOrNo("What is your name?")
      .then((res) => {
        console.log("User's name:", res.text);
        return res.text;
      })
      .run();
    const r1 = await bot.choice("Is this true? I have 2 fingers", {
      kind: "yesno",
    }); // r1.result.choice -> boolean
    console.log("r1:", r1);
    console.log("Done");
  })();
}
