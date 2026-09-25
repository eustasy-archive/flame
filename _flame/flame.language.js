////	Language
flame_language = navigator.languages ? navigator.languages[0] : ( navigator.userLanguage || navigator.systemLanguage || navigator.browserLanguage || navigator.language || session.locale.lang || false );
// Falls back to $_SERVER['HTTP_ACCEPT_LANGUAGE']
