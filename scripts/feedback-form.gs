/**
 * Creates the taab beta feedback Google Form in your Google account.
 *
 * 1. Open https://script.google.com and click "New project".
 * 2. Replace the code with this file, click Save, then Run (function: createFeedbackForm).
 * 3. Allow access when Google asks (it only creates this form).
 * 4. Open "Execution log": it prints the edit link and the prefilled link. Send the prefilled link to Claude.
 *
 * Apps Script can't add file-upload questions, so add "Screenshots" by hand (see the log).
 */
function createFeedbackForm() {
  const form = FormApp.create('taab beta feedback')
    .setDescription(
      'Thanks for testing taab! Tell us what worked, what broke and what you would like next. ' +
        'It takes about 3 minutes. Every answer is read by the team. ' +
        'You can also email taabsupport@gmail.com.',
    )
    .setProgressBar(true)
    .setConfirmationMessage('Thank you! Your feedback helps shape taab.')
    .setAllowResponseEdits(false);

  // 1. Overall rating
  form
    .addRatingItem()
    .setTitle('How would you rate taab so far?')
    .setRatingScaleLevel(5)
    .setRatingIcon(FormApp.RatingIconType.STAR)
    .setRequired(true);

  // 2. Usefulness
  const useful = form.addMultipleChoiceItem().setTitle('Would taab be useful to you?').setRequired(true);
  useful.setChoices([
    useful.createChoice('Yes, I would use it regularly'),
    useful.createChoice('Yes, but only for trips or events'),
    useful.createChoice('Maybe, I am not sure yet'),
    useful.createChoice('Not really'),
  ]);

  const uses = form.addCheckboxItem().setTitle('What would you use taab for?').setRequired(false);
  uses.setChoices([
    uses.createChoice('Flatmates / shared house bills'),
    uses.createChoice('Trips and holidays'),
    uses.createChoice('Events, parties and owambe'),
    uses.createChoice('Couples and family'),
    uses.createChoice('Friends eating out'),
    uses.createChoice('Ajo / savings circles'),
    uses.createChoice('Work or office lunches'),
  ]);
  uses.showOtherOption(true);

  form
    .addParagraphTextItem()
    .setTitle('Why, or why not?')
    .setHelpText('What problem would taab solve for you, or what stops it being useful?')
    .setRequired(false);

  // 3. Problems
  form.addPageBreakItem().setTitle('Problems and complaints').setHelpText('Anything that broke, confused you or annoyed you.');

  const problem = form.addMultipleChoiceItem().setTitle('Did anything go wrong while using taab?').setRequired(true);
  problem.setChoices([
    problem.createChoice('Yes, something did not work (a bug or error)'),
    problem.createChoice('Yes, something was confusing or annoying'),
    problem.createChoice('No, everything worked'),
  ]);

  form
    .addParagraphTextItem()
    .setTitle('What happened?')
    .setHelpText('What were you doing, what did you expect, and what happened instead? Include any error message you saw.')
    .setRequired(false);

  // 4. Features
  form.addPageBreakItem().setTitle('Ideas');

  form
    .addParagraphTextItem()
    .setTitle('Which features would you like us to add?')
    .setHelpText('Anything that would make taab more useful for you and the people you split with.')
    .setRequired(false);

  form.addParagraphTextItem().setTitle('Any other comments?').setRequired(false);

  // 5. About you (the app fills these in when opened from Send feedback)
  form.addPageBreakItem().setTitle('About your phone');

  const platform = form.addMultipleChoiceItem().setTitle('Where did you use taab?').setRequired(false);
  platform.setChoices([
    platform.createChoice('Android app'),
    platform.createChoice('iPhone app'),
    platform.createChoice('Website'),
  ]);

  const version = form
    .addTextItem()
    .setTitle('App version')
    .setHelpText('Filled in automatically when you open this form from taab.')
    .setRequired(false);

  form
    .addTextItem()
    .setTitle('Email or phone (optional)')
    .setHelpText('Only if you are happy for us to follow up about your feedback.')
    .setRequired(false);

  // The prefilled link tells the app which entry IDs to fill in.
  const prefilled = form
    .createResponse()
    .withItemResponse(platform.createResponse('Android app'))
    .withItemResponse(version.createResponse('APP_VERSION'))
    .toPrefilledUrl();

  Logger.log('Edit the form: ' + form.getEditUrl());
  Logger.log('Share with testers: ' + form.getPublishedUrl());
  Logger.log('Prefilled link for the app (send this to Claude): ' + prefilled);
  Logger.log(
    'Last step, by hand: open the edit link, click the "What happened?" question, then "+" > ' +
      'change the new question to "File upload", title it "Screenshots of the problem (optional)", ' +
      'allow "Image" only, max 5 files, 10 MB. Uploads need a Google sign-in.',
  );
}
