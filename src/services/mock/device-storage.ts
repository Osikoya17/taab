import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEMO_ALLOWANCES } from '@/features/billing/products';

import { configurePacks } from '../packs/runtime';
import { demoScanner } from '../packs/demo-scanner';
import { configureDatabase } from './db';

configureDatabase({ storage: AsyncStorage });
// The on-device demo has no server and no money: packs complete as labelled demos with sample scans.
configurePacks({ allowances: DEMO_ALLOWANCES, checkout: { mode: 'demo' }, scanner: demoScanner });
