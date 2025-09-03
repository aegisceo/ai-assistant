#!/usr/bin/env node

/**
 * Kill any process using port 3000
 */

const { exec } = require('child_process');

function killPort3000() {
  console.log('🔄 Checking for processes on port 3000...');
  
  const checkCommand = process.platform === 'win32' 
    ? 'netstat -ano | findstr :3000'
    : 'lsof -ti:3000';

  exec(checkCommand, (error, stdout) => {
    if (error || !stdout.trim()) {
      console.log('✅ Port 3000 is already free');
      return;
    }

    console.log('⚠️ Found processes on port 3000, killing them...');

    if (process.platform === 'win32') {
      const lines = stdout.trim().split('\n');
      const pids = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        return parts[parts.length - 1];
      }).filter(pid => pid && !isNaN(pid));

      if (pids.length === 0) {
        console.log('✅ No PIDs found to kill');
        return;
      }

      console.log(`🔄 Killing processes with PIDs: ${pids.join(', ')}`);
      
      pids.forEach(pid => {
        exec(`taskkill /PID ${pid} /F`, (killError) => {
          if (killError) {
            console.warn(`⚠️ Failed to kill PID ${pid}: ${killError.message}`);
          } else {
            console.log(`✅ Killed process ${pid}`);
          }
        });
      });
    } else {
      exec('kill -9 $(lsof -ti:3000)', (killError) => {
        if (killError) {
          console.warn(`⚠️ Failed to kill processes: ${killError.message}`);
        } else {
          console.log('✅ Killed processes on port 3000');
        }
      });
    }
  });
}

killPort3000();