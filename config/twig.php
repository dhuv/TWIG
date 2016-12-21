<?

define('TWIG\IMAP_SERVER', '{localhost:143/imap/notls}');
define('TWIG\DEFAULT_FOLDER', 'INBOX');
define('TWIG\MBOX_SEPERATOR', '.');
define('TWIG\SENT_FOLDER', 'INBOX.sent-mail');
define('TWIG\DRAFT_FOLDER', 'INBOX.Drafts');
define('TWIG\TRASH_FOLDER', 'INBOX.Trash');
define('TWIG\MISSEDSPAM_FOLDER', 'INBOX.missedspam');

// allow link for finance users
if (isset($http_request) && $http_request->checkPermissions(array(108), false)) {
	define('TWIG\FEATURE_LINKS', '[{"text":"Feature One", "href":"index.php?feat=featureone", "target":"featureone"}]');
}

?>
