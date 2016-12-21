<?

include_once('config/config.php');
include_once(SE\BASE_DIR. '/lib/class.db.php');

if (isset($_POST) && isset($_POST['auth1']) && isset($_POST['auth2'])) {
	$user = $_POST['auth1'];
	$pass = $_POST['auth2'];

	// verify login with DB
    $link = mysql_pconnect(SE\AUTH_DB_SERVER, SE\AUTH_DB_USER, SE\AUTH_DB_PASS);
    mysql_select_db(SE\AUTH_DB_DBASE);
    $query = 'SELECT id, username FROM vusers WHERE (username="' .mysql_real_escape_string($user, $link). '") AND (password LIKE BINARY "' .mysql_real_escape_string($pass, $link). '")';
    $result = mysql_query($query, $link);

    if (mysql_num_rows($result)== 1) {
		// create the session
		session_set_cookie_params(SE\SESS_LIFE, SE\SESS_PATH, SE\SESS_DOMAIN);
		session_start();
		$_SESSION['app_title'] = SE\APP_TITLE;
		$_SESSION['vuser'] = $user;
		$_SESSION['vpass'] = $pass;

		$row = mysql_fetch_row($result);
		$_SESSION['vid'] = $row[0];

		include_once(SE\BASE_DIR. '/lib/class.users.php');
		$uo = new twigUsers();
		$info = $uo->getUserFeatures($_SESSION['vid']);
		$_SESSION['userperms'] = $info['perms'];
		$_SESSION['cnames'] = $info['cnames'];
		$_SESSION['current_company'] = array_shift(array_keys($info['cnames']));

		// send the user in
		header('Location: index.php');
    } else {
		// failed auth
		header('Location: login.php');
        error_log('Invalid login with username "' .$user. '"');
    }
}

?>
