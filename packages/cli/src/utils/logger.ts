import chalk from "chalk";

export const logger = {
  info: (msg: string) => console.log(chalk.blue(msg)),
  success: (msg: string) => console.log(chalk.green(msg)),
  warn: (msg: string) => console.log(chalk.yellow(msg)),
  error: (msg: string) => console.error(chalk.red(msg)),
  raw: (msg: string) => console.log(msg),
  // Never log secrets – helper to ensure no env values leak
  safe: (msg: string) => {
    if (/(DATABASE_URL|JWT_SECRET|SECRET|PASSWORD|API_KEY)=/i.test(msg)) {
      console.log("[redacted secret]");
      return;
    }
    console.log(msg);
  },
};
