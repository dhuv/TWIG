<?
require('class.phpmailer.php');

class MyMail extends PHPMailer {
	// Set default variables for all new objects
	var $From	= '';
	var $FromName	= '';
	var $Host	= 'localhost';
	var $Mailer	= 'mail';
	var $WordWrap	= 80;
	var $CharSet     = 'utf8';
	var $ContentType = 'text/plain';
	var $Encoding    = '8bit';
	var $Priority	= 3;
}
?>
