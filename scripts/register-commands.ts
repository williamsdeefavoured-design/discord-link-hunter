import { registerGuildCommands } from '../apps/bot/src/register-commands.js';

registerGuildCommands().then((res) => {
  if (res.success) {
    console.log(`[Register] Complete: ${res.count} commands active on guild.`);
  } else {
    console.log(`[Register] Result: ${res.reason}`);
  }
});

