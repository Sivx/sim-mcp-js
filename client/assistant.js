import OpenAI from "openai";

export class Assistant {
  constructor(
    tools,
    toolsCallback,
    options = {
      model: "gpt-4.1-mini",
      instructions:
        "You are an assistant with access to external tools.  If the user is ambiguous, ask for clarification.  If you cannot answer, say 'I don't know'.",
    }
  ) {
    if (!tools?.length) throw new Error("tools required");
    this.client = new OpenAI();
    this.tools = tools;
    this.toolsCallback = toolsCallback;
    this.model = options.model;
    this.instructions = options.instructions;
    this.assistantId = null;
    this.threadId = null;
  }

  async whoami() {
    await this._ensureInitialized();
    console.log("Assistant ID:", this.assistantId);
    console.log("Thread ID:", this.threadId);
    return {
      assistantId: this.assistantId,
      threadId: this.threadId,
    };
  }

  async _ensureInitialized() {
    if (!this.assistantId || !this.threadId) {
      const resp = await this.client.beta.assistants.create({
        tools: this.tools,
        model: this.model,
        instructions: this.instructions,
      });
      this.assistantId = resp.id;
      const th = await this.client.beta.threads.create();
      this.threadId = th.id;
      if (!this.assistantId || !this.threadId)
        throw new Error("Initialization failed");
    }
  }

  async user(msg) {
    await this._ensureInitialized();
    await this.client.beta.threads.messages.create(this.threadId, {
      role: "user",
      content: msg,
    });

    const run = await this.client.beta.threads.runs.createAndPoll(
      this.threadId,
      { assistant_id: this.assistantId },
      { stream: false, pollIntervalMs: 100 }
    );
    //console.log("Run result:", run);

    if (
      run.status !== "requires_action" ||
      !run.required_action?.submit_tool_outputs?.tool_calls
    ) {
      if (run.status === "completed") {
        const messages = await this.client.beta.threads.messages.list(
          this.threadId
        );
        return messages.data.find((m) => m.role === "assistant");
      }
      return run;
    }

    const calls = run.required_action.submit_tool_outputs.tool_calls;
    const outputs = [];
    for (const call of calls) {
      const fn = call.function.name;
      const args = JSON.parse(call.function.arguments || "{}");
      const result = await this._executeTool(fn, args);
      outputs.push({
        tool_call_id: call.id,
        output: JSON.stringify(result),
      });
    }

    const finalRun =
      await this.client.beta.threads.runs.submitToolOutputsAndPoll(
        run.id,
        {
          tool_outputs: outputs,
          thread_id: this.threadId,
        },
        { stream: false, pollIntervalMs: 100 }
      );

    if (finalRun.status === "completed") {
      const messages = await this.client.beta.threads.messages.list(
        this.threadId
      );
      const assistantMessages = messages.data.filter(
        (m) => m.role === "assistant" && m.run_id === finalRun.id
      );
      if (assistantMessages.length) {
        const msg = assistantMessages[0];
        const text = msg.content.map((c) => c.text?.value ?? "").join("");
        //console.log("Assistant:", text);
        return text;
      } else {
        console.log("No assistant messages returned.");
      }
    }

    return finalRun;
  }

  async _executeTool(functionName, args) {
    console.log(`Executing tool: ${functionName} with args`, args);

    if (this.toolsCallback) {
      try {
        return await this.toolsCallback(functionName, args);
      } catch (e) {
        console.error("Error in toolsCallback:", e);
        return {
          error: `Error executing tool: ${functionName} - ${e.message}`,
        };
      }
    }
    return { message: `Unknown function: ${functionName}` };
  }
}
