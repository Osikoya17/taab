import AsyncStorage from '@react-native-async-storage/async-storage';

import { configureDatabase } from './db';

configureDatabase({ storage: AsyncStorage });
