import * as dotenv from 'dotenv';
import * as path from 'path';
import { BotConfig } from '../types';

dotenv.config();

export const config: BotConfig = {
    commandPrefix: process.env.COMMAND_PREFIX || '!',
    warnThreshold: parseInt(process.env.WARN_THRESHOLD || '3', 10),
    muteDurationHours: parseInt(process.env.MUTE_DURATION_HOURS || '2', 10),
    sessionPath: path.join(__dirname, '../../sessions'),
    dataPath: path.join(__dirname, '../../data'),
};

export default config;
