import chalk from 'chalk';

export const logger = {
  info: (msg: string) => console.log(chalk.blue('[INFO]'), msg),
  ok: (msg: string) => console.log(chalk.green('[OK]'), msg),
  warn: (msg: string) => console.log(chalk.yellow('[WARN]'), msg),
  error: (msg: string) => console.log(chalk.red('[ERROR]'), msg),
  dim: (msg: string) => console.log(chalk.dim(msg)),

  header: (msg: string) => {
    console.log('');
    console.log(chalk.bold.cyan(`  ${msg}`));
    console.log(chalk.dim('  ' + '─'.repeat(msg.length + 2)));
  },

  table: (rows: [string, string][]) => {
    const maxKey = Math.max(...rows.map(([k]) => k.length));
    for (const [key, value] of rows) {
      console.log(`  ${chalk.dim(key.padEnd(maxKey))}  ${value}`);
    }
  },

  fileAction: (action: 'create' | 'update' | 'skip' | 'conflict' | 'backup', path: string) => {
    const icons: Record<string, string> = {
      create: chalk.green('+'),
      update: chalk.yellow('~'),
      skip: chalk.dim('-'),
      conflict: chalk.red('!'),
      backup: chalk.blue('B'),
    };
    console.log(`  ${icons[action]} ${path}`);
  },
};
