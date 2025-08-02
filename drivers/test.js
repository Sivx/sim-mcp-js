import readline from "readline";

const bots = [
  { name: "Alpha", message: "Monitoring network activity...", weight: 1 },
  { name: "Beta", message: "Processing recent tasks...", weight: 2 },
  { name: "Gamma", message: "Awaiting new instructions...", weight: 3 },
  { name: "Delta", message: "Synchronizing data streams...", weight: 1 },
  { name: "Epsilon", message: "Idle.", weight: 4 },
];

const getTerminalWidth = () => process.stdout.columns || 80;
let width = getTerminalWidth() - 2;
let pos = 0;
let marqueeRunning = true;

process.stdout.write("\n");
for (let i = 0; i < bots.length; i++) process.stdout.write("\n");

function padMessage(msg, len) {
  if (msg.length < len) return msg + " ".repeat(len - msg.length);
  return msg + "   ";
}

const botOffsets = Array(bots.length).fill(0);

function printMarquees() {
  width = getTerminalWidth() - 2;
  process.stdout.write(`\x1B[${bots.length + 1}A`);
  process.stdout.write("=".repeat(width) + "\n");
  for (let i = 0; i < bots.length; i++) {
    const prefix = `[Bot ${i + 1}] `;
    const msgWidth = width - prefix.length;
    const padded = padMessage(bots[i].message, msgWidth);
    const offset = botOffsets[i] % padded.length;
    const scroll = padded.slice(offset) + padded.slice(0, offset);
    process.stdout.write(
      prefix + scroll.slice(0, msgWidth).padEnd(msgWidth) + "\n"
    );
    // Increment offset according to bot weight (lower weight = faster scroll)
    if (pos % bots[i].weight === 0) botOffsets[i]++;
  }
  pos++;
}

let interval = setInterval(() => {
  if (marqueeRunning) printMarquees();
}, 100);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function promptInput() {
  rl.question("Provide input: ", (cmd) => {
    if (cmd.trim().toLowerCase() === "exit") {
      rl.close();
      process.exit(0);
    }
    if (!cmd.trim()) {
      marqueeRunning = true;
      interval = setInterval(() => {
        if (marqueeRunning) printMarquees();
      }, 100);
      console.log("Press Enter to provide input.");
      return;
    }
    marqueeRunning = true;
    interval = setInterval(() => {
      if (marqueeRunning) printMarquees();
    }, 100);
    console.log("Press Enter to provide input.");
  });
}

rl.on("line", () => {
  marqueeRunning = false;
  clearInterval(interval);
  promptInput();
});

console.log("Press Enter to provide input.");
