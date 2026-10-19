import type { Messages } from './index';
import { filters, login, settings, shell } from './shell';
import { web } from './web';
import { social } from './social';
import { seo } from './seo';
import { geo } from './geo';
import { ads } from './ads';
import { content } from './content';
import { insights } from './insights';
import { reports } from './reports';

export const modules: Record<string, Messages> = { filters, shell, login, settings, web, social, seo, geo, ads, content, insights, reports };
