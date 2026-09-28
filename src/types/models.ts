/**
 * Domain models. All monetary values are integers in the currency's smallest
 * unit (kobo for NGN, cents for USD, ...). Never store floats for money.
 */

export type CurrencyCode = 'NGN' | 'USD' | 'GBP' | 'EUR';

/** An integer amount in the smallest currency unit. */
export type MinorUnits = number;

export type ISODateString = string;

export type UseCase = 'friends' | 'roommates' | 'trips' | 'couples' | 'family' | 'work' | 'other';

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  defaultCurrency: CurrencyCode;
  createdAt: ISODateString;
};

export type UserProfile = User & {
  useCase?: UseCase;
  setupComplete: boolean;
};

export type GroupType = 'home' | 'trip' | 'friends' | 'couple' | 'event' | 'work' | 'other';

export type GroupMember = {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  /** Pending members were invited by email/phone and have not joined yet. */
  status: 'active' | 'invited';
  joinedAt: ISODateString;
};

export type Group = {
  id: string;
  name: string;
  description?: string;
  type: GroupType;
  currency: CurrencyCode;
  members: GroupMember[];
  createdBy: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type SplitMethod = 'equal' | 'exact' | 'percentage' | 'shares';

export type ExpensePayer = {
  userId: string;
  amount: MinorUnits;
};

export type ExpenseSplit = {
  userId: string;
  /** The resolved share this person owes towards the expense. */
  amount: MinorUnits;
  /**
   * The raw input used to compute `amount`: minor units for exact, basis points
   * (1/100th of a percent) for percentage, share count for shares. Absent for equal.
   */
  value?: number;
};

export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'home'
  | 'utilities'
  | 'entertainment'
  | 'groceries'
  | 'travel'
  | 'subscriptions'
  | 'other';

/** What someone typed when they entered an expense in a currency other than the taab's. */
export type ForeignAmount = {
  amount: MinorUnits;
  currency: CurrencyCode;
  /** Units of the taab's currency per one unit of `currency`, at entry time. */
  rate: number;
};

export type Expense = {
  id: string;
  groupId: string;
  title: string;
  amount: MinorUnits;
  currency: CurrencyCode;
  paidBy: ExpensePayer[];
  splitBetween: ExpenseSplit[];
  splitMethod: SplitMethod;
  category?: ExpenseCategory;
  notes?: string;
  receiptUrl?: string;
  /** Set when it was entered in another currency; `amount` is the converted value. */
  original?: ForeignAmount;
  /** When the expense happened (user-editable). */
  date: ISODateString;
  recurringId?: string;
  createdBy: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

/**
 * How a payment was made. Only external methods exist today; `in_app` is
 * reserved for native payments so the model does not need to change later.
 */
export type SettlementMethod = 'bank_transfer' | 'cash' | 'other' | 'in_app';

export type Settlement = {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: MinorUnits;
  currency: CurrencyCode;
  method?: SettlementMethod;
  note?: string;
  createdBy: string;
  createdAt: ISODateString;
};

export type ActivityType =
  | 'expense_created'
  | 'expense_edited'
  | 'expense_deleted'
  | 'payment_recorded'
  | 'member_joined'
  | 'group_created'
  | 'reminder_sent';

export type ActivityEvent = {
  id: string;
  type: ActivityType;
  groupId: string;
  groupName: string;
  actorId: string;
  actorName: string;
  /** Optional counterpart, e.g. the payee of a payment or the reminded member. */
  targetUserId?: string;
  targetName?: string;
  expenseId?: string;
  title?: string;
  amount?: MinorUnits;
  currency?: CurrencyCode;
  createdAt: ISODateString;
};

export type Reminder = {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: MinorUnits;
  currency: CurrencyCode;
  message: string;
  createdAt: ISODateString;
};

export type RecurringFrequency = 'weekly' | 'monthly' | 'custom';

export type RecurringExpense = {
  id: string;
  groupId: string;
  title: string;
  amount: MinorUnits;
  currency: CurrencyCode;
  paidBy: ExpensePayer[];
  splitBetween: ExpenseSplit[];
  splitMethod: SplitMethod;
  frequency: RecurringFrequency;
  /** Only used when frequency is `custom`. */
  intervalDays?: number;
  /** Original day of month, retained across shorter months. */
  anchorDay?: number;
  nextDate: ISODateString;
  /** When true, the expense is created automatically; otherwise the user confirms it. */
  autoCreate: boolean;
  createdBy: string;
  createdAt: ISODateString;
};

export type NotificationCategory =
  | 'new_expense'
  | 'payment_received'
  | 'settlement'
  | 'reminder'
  | 'member_joined'
  | 'recurring_expense'
  | 'group_activity';

export type NotificationPreferences = Record<NotificationCategory, boolean>;

export type AppNotification = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  groupId?: string;
  expenseId?: string;
  read: boolean;
  createdAt: ISODateString;
};
