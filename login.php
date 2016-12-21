<?
include_once('./config/config.php');
include_once('./lib/common.php');

$mypage_title = SE\APP_TITLE;
include_once('header.php');

include_once('./lib/browser.php');
$binfo = getBrowserInfo();
?>

		<style>
			input[type=text], input[type=password] {border:0px solid #ddd; padding:5px; background-color:#fff; font-size:12px; border-radius:5px; margin-top:15px; box-shadow:inset 0 0 1px #555;}
			div.left_column input:-moz-placeholder {color:#bbb;}
			div.left_column, div.right_column {float:left; margin:0; margin-top:20%; width:46%; padding:0 2%; text-align:right;}

			div.right_column {float:left; margin:0; margin-top:15%; width:40%; padding:5%; text-align:left; color:#555;}
			div.date {margin-left:20px; font-size:32px; line-height:32px; font-weight:300;}
			span.month, span.date {text-shadow:#ccc 0px 1px;}
			div.line {font-size:14px; margin-left:20px; text-shadow:#ccc 0px 1px; margin-top:5px;}
		</style> 

		<div class="left_column">
			<form id="login_form" name="login_form" method="POST" action="auth.php">
				<div class="textbox"><input type="text" id="auth1" name="auth1" placeholder="Username" title="Username"></div>
				<div class="textbox"><input type="password" id="auth2" name="auth2" placeholder="Password" title="Password"></div>
			</form>
		</div>
		<div class="right_column">
			<div class="date">
				<span class="month"><? echo date('F'); ?></span>
				<span class="date"><? echo date('d'); ?></span>
			</div>
			<div class="line ipaddr"><? echo $_SERVER['REMOTE_ADDR']; ?></div>
			<div class="line browser" title="<? echo $_SERVER['HTTP_USER_AGENT']; ?>">
				<span class="browser"><? echo $binfo['shortname']. ' ' .$binfo['version']; ?></span>
			</div>
			<div class="line platform">
				<span class="platform"><? echo $binfo['platform']. ' ' .$binfo['os_version']; ?></span>
			</div>
		</div>

	<script type="text/javascript">
		function authInit() {
			$('auth2').addEvent('keyup', function (e) {		
				if (e.key == 'enter') { $('login_form').submit(); }
			});

	    	$('auth1').select();
		}

		addLoadEvent(authInit());
	</script>

<? include_once('footer.php'); ?>
