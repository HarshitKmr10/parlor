export const CONTACT_METHODS = {
  phoneNumber: 'phoneNumber',
  meetingUrl: 'meetingUrl',
};

export const FORM_FIELDS = {
  link: '',
  title: '',
  phoneNumber: '',
  botName: '',
};

// after login we need to remove some query params from the url
export const SanitizedQueryParams = ['chatId'];