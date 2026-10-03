/**
 * Creates the taab interest survey: would people who haven't tried taab use an app like it?
 * Asks how people share costs today before describing taab, so the idea doesn't steer the answers.
 *
 * 1. Sign in to https://script.google.com as taabsupport@gmail.com and click "New project".
 * 2. Replace the code with this file, click Save, then Run (function: createInterestSurvey).
 * 3. Allow access when Google asks (it creates this form and a Google Sheet for the answers).
 * 4. Open "Execution log" for the links: share the short link with potential users.
 */
function createInterestSurvey() {
  const form = FormApp.create('Sharing costs with friends: 3-minute survey')
    .setDescription(
      'We are building an app to make sharing costs with friends, flatmates and family easier, ' +
        'and want to understand how people do it today. It takes about 3 minutes. ' +
        'Answers are anonymous unless you choose to leave contact details at the end, ' +
        'and are only used to shape the app. Questions: taabsupport@gmail.com',
    )
    .setProgressBar(true)
    .setAllowResponseEdits(false)
    .setConfirmationMessage(
      'Thank you! Your answers help shape the app. If you left your details, we will let you know when it is ready.',
    );

  // ---- Page 1: how people share costs today (before any pitch) ----
  const often = form.addMultipleChoiceItem().setTitle('How often do you share costs with other people?').setRequired(true);
  often.setChoices([
    often.createChoice('Every week or more'),
    often.createChoice('A few times a month'),
    often.createChoice('A few times a year'),
    often.createChoice('Rarely or never'),
  ]);

  const who = form.addCheckboxItem().setTitle('Who do you share costs with?').setHelpText('Choose all that apply.').setRequired(false);
  who.setChoices([
    who.createChoice('Flatmates or housemates (rent, bills, food)'),
    who.createChoice('Friends eating or going out'),
    who.createChoice('Trips and holidays'),
    who.createChoice('Events, parties and owambe'),
    who.createChoice('Partner or family'),
    who.createChoice('Colleagues (lunches, gifts, contributions)'),
    who.createChoice('Ajo, esusu or a savings group'),
  ]);
  who.showOtherOption(true);

  const track = form.addCheckboxItem().setTitle('How do you keep track of who owes what today?').setHelpText('Choose all that apply.').setRequired(true);
  track.setChoices([
    track.createChoice('I just remember'),
    track.createChoice('Notes app or paper'),
    track.createChoice('WhatsApp messages'),
    track.createChoice('A spreadsheet'),
    track.createChoice('Another app (for example Splitwise)'),
    track.createChoice('One person pays and the others transfer straight away'),
    track.createChoice('We don’t keep track'),
  ]);
  track.showOtherOption(true);

  const outOfPocket = form
    .addMultipleChoiceItem()
    .setTitle('How often do you end up out of pocket because someone forgot or never paid you back?')
    .setRequired(true);
  outOfPocket.setChoices([
    outOfPocket.createChoice('Often'),
    outOfPocket.createChoice('Sometimes'),
    outOfPocket.createChoice('Rarely'),
    outOfPocket.createChoice('Never'),
  ]);

  const amount = form.addMultipleChoiceItem().setTitle('Roughly how much do you share with others in a month?').setRequired(false);
  amount.setChoices([
    amount.createChoice('Under ₦10,000'),
    amount.createChoice('₦10,000 to ₦50,000'),
    amount.createChoice('₦50,000 to ₦200,000'),
    amount.createChoice('Over ₦200,000'),
    amount.createChoice('Not sure'),
  ]);

  form
    .addParagraphTextItem()
    .setTitle('What is the most annoying part of sharing costs?')
    .setHelpText('For example chasing people, working out the maths, or awkward conversations.')
    .setRequired(false);

  // ---- Page 2: the idea ----
  form
    .addPageBreakItem()
    .setTitle('The idea')
    .setHelpText(
      'taab is a free app for groups. You add what you spent, it works out who owes whom, ' +
        'and everyone settles up by bank transfer using the account details people add. ' +
        'A payment only counts once the person who received it confirms, and every edit is visible to the group.',
    );

  form
    .addScaleItem()
    .setTitle('How likely would you be to use an app like this?')
    .setBounds(1, 5)
    .setLabels('Not at all likely', 'Very likely')
    .setRequired(true);

  const firstUse = form.addCheckboxItem().setTitle('What would you use it for first?').setRequired(false);
  firstUse.setChoices([
    firstUse.createChoice('Flat or house bills'),
    firstUse.createChoice('A trip'),
    firstUse.createChoice('An event or party'),
    firstUse.createChoice('Eating out with friends'),
    firstUse.createChoice('Family or partner costs'),
    firstUse.createChoice('Office contributions'),
    firstUse.createChoice('A savings group'),
  ]);
  firstUse.showOtherOption(true);

  const features = form
    .addCheckboxItem()
    .setTitle('Which features would matter most to you?')
    .setHelpText('Choose up to 3.')
    .setRequired(false);
  features.setChoices([
    features.createChoice('Splitting equally, by amount, by percentage or by shares'),
    features.createChoice('Reminders for people who owe me'),
    features.createChoice('Payments only count once the receiver confirms'),
    features.createChoice('Showing my bank details so people can pay me quickly'),
    features.createChoice('Scanning receipts to fill in expenses'),
    features.createChoice('A PDF summary of a trip or event'),
    features.createChoice('Different currencies (naira, dollars, pounds, euros)'),
    features.createChoice('Recurring bills like rent or subscriptions'),
    features.createChoice('Fingerprint lock'),
  ]);
  features.setValidation(FormApp.createCheckboxValidation().requireSelectAtMost(3).build());

  const blockers = form.addCheckboxItem().setTitle('What might stop you from using it?').setHelpText('Choose all that apply.').setRequired(false);
  blockers.setChoices([
    blockers.createChoice('My friends wouldn’t join'),
    blockers.createChoice('Recording every expense feels like effort'),
    blockers.createChoice('I’m not comfortable sharing bank details in an app'),
    blockers.createChoice('WhatsApp or notes work well enough'),
    blockers.createChoice('I don’t share costs often'),
    blockers.createChoice('Nothing, I’d try it'),
  ]);
  blockers.showOtherOption(true);

  const scanPack = form
    .addMultipleChoiceItem()
    .setTitle('The app is free. Would you pay ₦1,000 once for a pack of receipt scans?')
    .setHelpText('You photograph a receipt and the app fills in the expense for you to check.')
    .setRequired(false);
  scanPack.setChoices([scanPack.createChoice('Yes'), scanPack.createChoice('Maybe'), scanPack.createChoice('No')]);

  const tripPack = form
    .addMultipleChoiceItem()
    .setTitle('Would your group pay ₦2,000 once for a trip or event pack?')
    .setHelpText('Shared receipt scanning for everyone in the group and a PDF summary at the end.')
    .setRequired(false);
  tripPack.setChoices([tripPack.createChoice('Yes'), tripPack.createChoice('Maybe'), tripPack.createChoice('No')]);

  // ---- Page 3: about you ----
  form.addPageBreakItem().setTitle('About you').setHelpText('Optional, but it helps us understand who the app is for.');

  const age = form.addMultipleChoiceItem().setTitle('Age').setRequired(false);
  age.setChoices(['Under 18', '18 to 24', '25 to 34', '35 to 44', '45 or older'].map((a) => age.createChoice(a)));

  const city = form.addMultipleChoiceItem().setTitle('Where do you live?').setRequired(false);
  city.setChoices(['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Elsewhere in Nigeria', 'Outside Nigeria'].map((c) => city.createChoice(c)));

  const work = form.addMultipleChoiceItem().setTitle('What do you do?').setRequired(false);
  work.setChoices(['Student', 'Employed', 'Self-employed or business owner', 'Not working at the moment'].map((w) => work.createChoice(w)));
  work.showOtherOption(true);

  const phone = form.addMultipleChoiceItem().setTitle('Which phone do you use?').setRequired(false);
  phone.setChoices(['Android', 'iPhone', 'Both'].map((p) => phone.createChoice(p)));

  const banks = form.addCheckboxItem().setTitle('Which bank or money apps do you use to send money?').setRequired(false);
  banks.setChoices(
    ['OPay', 'Moniepoint', 'PalmPay', 'Kuda', 'Zap', 'GTBank', 'Access Bank', 'Zenith Bank', 'First Bank', 'UBA', 'ALAT (Wema)', 'Fidelity', 'Stanbic IBTC', 'Sterling', 'FCMB', 'Union Bank', 'Ecobank', 'Paga', 'Carbon', 'FairMoney'].map(
      (b) => banks.createChoice(b),
    ),
  );
  banks.showOtherOption(true);

  form
    .addTextItem()
    .setTitle('Want to hear when it is ready? Leave your email or WhatsApp number')
    .setHelpText('Optional. We will only use it to tell you when the app is ready, and you can ask us to delete it at any time.')
    .setRequired(false);

  // Answers also go to a Google Sheet, for sorting and charts.
  const sheet = SpreadsheetApp.create('taab interest survey (responses)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  const published = form.getPublishedUrl();
  Logger.log('Share with potential users: ' + form.shortenFormUrl(published));
  Logger.log('Full link: ' + published);
  Logger.log('Edit the form: ' + form.getEditUrl());
  Logger.log('Responses sheet: ' + sheet.getUrl());
}
