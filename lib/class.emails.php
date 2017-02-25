<?

include_once(SE\BASE_DIR. '/config/twig.php');

/*
 * Class to access IMAP mailbox
 */

class TWIGEmails {
	protected $mbox = null;

	function __construct () {
		// connect the MBOX
		if (!isset($_SESSION['mailfolder'])) { $_SESSION['mailfolder'] = TWIG\DEFAULT_FOLDER; }

		$this->mbox = imap_open(TWIG\IMAP_SERVER.$_SESSION['mailfolder'], $_SESSION['vuser'], $_SESSION['vpass']);
		if (!$this->mbox) {
			to_log('Error connecting to mailbox.' .TWIG\IMAP_SERVER.$_SESSION['mailfolder']);
			throw new Exception('Error connecting to mailbox. Please contact the administrator', 1001);
		}
	}

	function __destruct () {
		// call imap_errors and imap_alerts so the stacks are cleared before the close
		// this avoids PHP Notices in the php error log
		imap_errors();
		imap_alerts();
		imap_close($this->mbox);
	}
	
	/*
	 * Gets a list of subscribed folders for this user
	 * @param bool $onlysubscribed (true gets only subscribed, false gets all)
	 * @return $folders {'folder'=>'subscribed'}
	 */
	public function getFoldersList ($onlysubscribed=true) {
		if ($onlysubscribed) {
			$flist = imap_lsub($this->mbox, TWIG\IMAP_SERVER, '*');
		} else {
			$flist = imap_list($this->mbox, TWIG\IMAP_SERVER, '*');
		}
		sort($flist);

		$folders = array();
		for ($i=0; $i<count($flist); $i++) {
			$fsplit = explode(TWIG\MBOX_SEPERATOR, str_replace(TWIG\IMAP_SERVER, '', trim($flist[$i])));

			$curfolder = &$folders;
			for ($j=0; $j<count($fsplit); $j++) {
				if (!isset($curfolder[$fsplit[$j]])) {
					$curfolder[$fsplit[$j]] = array();
				}

				$curfolder = &$curfolder[$fsplit[$j]];
			}
		}

		return $folders;
	}

	/*
	 * Get a list of message hearders within a set
	 * @param int $start of message set
	 * @param int $count number of messages in the list (null for all)
	 * @return array messageHeaders
	 */    
	public function getHeaders ($start, $count=null) {
		if (!is_int($start)) { throw new Exception ('Invalid format specified for start', 1001); }
		if ($count != null && !is_int($count)) { throw new Exception ('Invalid format specified for count', 1001); }

		// make sure start is at least 1
		if ($start == 0) { $start = 1; }

		// get the set
		$theSet = $start. ':';
		if ($count !== null) { $theSet .= ($start + $count); }

		// gather message info
	   	$headers = array_reverse(imap_fetch_overview($this->mbox, $theSet));

		$issent = ($_SESSION['mailfolder'] == TWIG\SENT_FOLDER);

		// fix headers
		for ($i=0; $i<count($headers); $i++) {
			if ($issent) {
				// fix to
				if (isset($headers[$i]->to)) {
					$headers[$i]->toinfo = parseEmailAddress($headers[$i]->to);
				}
			} else {
				// fix from
				if (isset($headers[$i]->from)) {
					$headers[$i]->frominfo = parseEmailAddress($headers[$i]->from);
				}
			}
			// fix subject
			if (isset($headers[$i]->subject)) {
				$headers[$i]->subject = iconv_mime_decode($headers[$i]->subject, 0, 'UTF-8');
			}
		}

		return $headers;
	}
  
	/*
	 * Search for messages in a folder
	 * @param array $criteria {'from', 'to', 'cc', 'subject', 'body', 'flagged'}
	 * @return array $messageHeaders 
	 */
	public function searchEmails ($criteria) {
		// get the message list
		$searchText = '';
		if (isset($criteria['from'])) { $searchText .= ' FROM "' .$criteria['from']. '"'; }
		if (isset($criteria['to'])) { $searchText .= ' TO "' .$criteria['to']. '"'; }
		if (isset($criteria['cc'])) { $searchText .= ' CC "' .$criteria['cc']. '"'; }
		if (isset($criteria['subject'])) { $searchText .= ' SUBJECT "' .$criteria['subject']. '"'; }
		if (isset($criteria['body'])) { $searchText .= ' BODY "' .$criteria['body']. '"'; }
		if (isset($criteria['flagged'])) { $searchText .= ' FLAGGED'; }
		if (isset($criteria['new'])) { $searchText .= ' UNSEEN'; }
		if (isset($criteria['since'])) { $searchText .= ' SINCE "' .$criteria['since']. '"'; }
	
		$mesgids = imap_search($this->mbox, $searchText);

		// if there are no messages, 
		if (!$mesgids) { return array(); }
		$mesgseq = implode(',', $mesgids);
  
		// get hearders for those messages
		$headers = array_reverse(imap_fetch_overview($this->mbox, $mesgseq));

		$issent = ($_SESSION['mailfolder'] == TWIG\SENT_FOLDER);

		// fix headers
		for ($i=0; $i<count($headers); $i++) {
			if ($issent) {
				// fix to
				if (isset($headers[$i]->to)) {
					$headers[$i]->toinfo = parseEmailAddress($headers[$i]->to);
				}
			} else {
				// fix from
				if (isset($headers[$i]->from)) {
					$headers[$i]->frominfo = parseEmailAddress($headers[$i]->from);
				}
			}
			// fix subject
			if (isset($headers[$i]->subject)) {
				$headers[$i]->subject = iconv_mime_decode($headers[$i]->subject, 0, 'UTF-8');
			}
		}
 
		return $headers;
	}
  
	/*
	 * Gets details for a specific message
	 * @param int $msguid UID of a message
	 * @return $messageInfo {'headers', 'attachments', 'body'}
	 */
	public function getEmail ($msguid) {
		$einfo = array('attachments'=>array());
  
		// get the headers 
		$headers = "\n" .imap_fetchheader($this->mbox, $msguid, FT_UID);
	
		// put headers into a key/value pair array
		$foo = preg_split("/\n(\S*):/", $headers, -1, PREG_SPLIT_DELIM_CAPTURE);
		for ($i=1; $i<count($foo); $i++) {
			$fullheaders[trim($foo[$i])] = iconv_mime_decode((trim($foo[$i+1])), 2, 'UTF-8');
			$i++;
		}

		// narrowing down problem emails
		if (json_encode($fullheaders) == null) { error_log('ERROR with message ' .$msguid. ' in folder ' .$_SESSION['mailfolder']. ' for user ' .$_SESSION['vuser']); }
	
		// sometimes the header comes in as CC instead of Cc
		if (!isset($fullheaders['To']) && isset($fullheaders['TO'])) { $fullheaders['To'] = $fullheaders['TO']; unset($fullheaders['TO']); }
		if (!isset($fullheaders['Cc']) && isset($fullheaders['CC'])) { $fullheaders['Cc'] = $fullheaders['CC']; unset($fullheaders['CC']); }
		$einfo['fullheaders'] = $fullheaders;
   
		// go through structure and get body and attachments
		$thestructure = imap_fetchstructure($this->mbox, $msguid, FT_UID);
		$theresult = $this->TWIGGetMsgInfo($thestructure);
		$msgtext = ''; $htmltext = '';
		foreach ($theresult as $key => $val) {
			// add the text to the body
			if ($val['mimesubtype'] == 'PLAIN' && $val['filename'] == 'no__name') {
				$tmptext = imap_fetchbody($this->mbox, $msguid, $key, FT_UID);
				switch ($val['encoding']) {
				case 1:
					$msgtext .= imap_utf8($tmptext); 
					break;
				case 3:
					$msgtext .= imap_base64($tmptext); 
					break;
				case 4:
					$msgtext .= quoted_printable_decode($tmptext);
					break;
				default:
					$msgtext .= $tmptext;	
				}
			} else if ($val['mimesubtype'] == 'HTML') {
				$tmptext = imap_fetchbody($this->mbox, $msguid, $key, FT_UID);
	 			switch ($val['encoding']) {
				case 1:
					$htmltext .= imap_utf8($tmptext); 
					break; 
				case 3:
					$htmltext .= imap_base64($tmptext); 
					break;
				case 4:
					$htmltext .= quoted_printable_decode($tmptext);
					break;
				default:
					$htmltext .= $tmptext;	
				} 
			} else if ($val['filename'] != 'no__name' && $val['mimetype'] != '') {
				// add attachment info
				$val['part'] = $key;
				$einfo['attachments'][] = $val;
			}
		}
                                  
		$patterns = array(chr(160), chr(194));
		$replacements = array('', '');
		$msgtext = str_replace($patterns, $replacements, $msgtext);

		$patterns = array('<a href=', '<area ', chr(160), chr(194), chr(174), chr(226), chr(128), chr(153), chr(183));
		$replacements = array('<a target="_new" href=', '<area target="_new" ', '', '', '', '', '', '', '');
		$htmltext = str_replace($patterns, $replacements, $htmltext);

		if (json_encode($msgtext)) {
			$tmptext = '';
			for ($i=0; $i<strlen($msgtext); $i++) {
				$tmptext .= (ord($msgtext{$i}) > 127)?'':$msgtext{$i};
			}
			$msgtext = $tmptext;
		}

		if (json_encode($htmltext)) {
 			$tmptext = '';
			for ($i=0; $i<strlen($htmltext); $i++) {
				$tmptext .= (ord($htmltext{$i}) > 127)?'':$htmltext{$i};
			}
			$htmltext = $tmptext;
		}

		$einfo['text'] = trim($msgtext);
		$einfo['html'] = trim($htmltext);

		return $einfo;
	}
 
    /*
     * Delets a message by ID
     * @param array $msguids
	 * @return bool true on success
     */
    public function deleteEmails ($msguids) {
	    if(!imap_delete($this->mbox, implode($msguids, ','), FT_UID)) {
			return false;
    	}

		imap_expunge($this->mbox);

		return true;
	}

    /*
     * Undeletes a message by ID
     * @param string $msguid
     */
    public function undeleteEmail ($msguid) {
	}
   
   	/*
	 * Send a list of messages to the Trash folder
	 * @param array $msguids (message IDs)
	 * @return bool true on success
	 */             
	public function trashEmails ($msguids) {
		// verify list contains uids
		if (!is_array($msguids) || count($msguids) == 0) { throw new Exception ('Message IDs not specified. Could not move to trash.', 1001); }

	   	if (!imap_mail_move($this->mbox, implode($msguids, ','), TWIG\TRASH_FOLDER, CP_UID)) { 
			imap_createmailbox($this->mbox, TWIG\IMAP_SERVER.TWIG\TRASH_FOLDER);
			imap_subscribe($this->mbox, TWIG\IMAP_SERVER.TWIG\TRASH_FOLDER);
			if (imap_mail_move($this->mbox, $msguids, TWIG\TRASH_FOLDER, CP_UID)) {
				imap_expunge($this->mbox);
				return true;
			}

			return false;
		}
	
		imap_expunge($this->mbox);

		return true;
	}
   
   	/*
	 * Move a list of messages to the spam folder
	 * @param array $msguids (message IDs)
	 * @return bool true on success
	 */             
	public function spamEmails ($msguids) {
		// verify list contains uids
		if (!is_array($msguids) || count($msguids) == 0) { throw new Exception ('Message IDs not specified. Could not mark as spam.', 1001); }

		if (!imap_mail_move($this->mbox, implode($msguids, ','), TWIG\MISSEDSPAM_FOLDER, CP_UID)) {
			imap_createmailbox($this->mbox, TWIG\IMAP_SERVER.TWIG\MISSEDSPAM_FOLDER);
			imap_subscribe($this->mbox, TWIG\IMAP_SERVER.TWIG\MISSEDSPAM_FOLDER);
			if (imap_mail_move($this->mbox, $msguids, TWIG\MISSEDSPAM_FOLDER, CP_UID)) {
				imap_expunge($this->mbox);
				return true;
			}

			return false; 
		}
	
		imap_expunge($this->mbox);

		return true;
	}

	/*
	 * Clears flags for messages
	 * @param array $msguids (message IDs)
	 * @param string flag
	 */
	public function clearEmailFlag ($msguids, $flag) {
		$flags = array('Seen'=>'\\Seen', 'Replied'=>'\\Answered', 'Flagged'=>'\\Flagged', 'Deleted'=>'\\Deleted', 'Drafted'=>'\\Draft');

		if (!isset($flags[$flag])) { throw new Exception('Invalid Flag specified', 1001); }

		if(!imap_clearflag_full($this->mbox, implode(',', $msguids), $flags[$flag], ST_UID)) { throw new Exception ('Error setting flag on messages'); }

		return true;
	}
 
	/*
	 * Set flags for messages
	 * @param array $msguids (message IDs)
	 * @param string flag
	 */
	public function setEmailFlag ($msguids, $flag) {
		$flags = array('Seen'=>'\\Seen', 'Replied'=>'\\Answered', 'Flagged'=>'\\Flagged', 'Deleted'=>'\\Deleted', 'Draft'=>'\\Draft');

		if (!isset($flags[$flag])) { throw new Exception('Invalid Flag specified', 1001); }

		if(!imap_setflag_full($this->mbox, implode(',', $msguids), $flags[$flag], ST_UID)) { throw new Exception ('Error setting flag on messages'); }

		return true;
	}
    
   	/*
	 * Copy a list of messages to another folder
	 * @param array $msguids (message IDs)
	 * @param string $destFolder
	 * @return bool true on success
	 */             
	public function copyEmails ($msguids, $destFolder) {
		if (!$destFolder) { throw new Exception ('Destination folder not specified, could not copy', 1001); }
		if (!$this->folderExists($destFolder)) { throw new Exception ('Destination folder does not exist, could not copy', 1001); }
		if (!is_array($msguids)) { throw new Exception ('Invalid format for message IDs', 1001); }
	
		$result = imap_mail_copy($this->mbox, implode(',', $msguids), $destFolder, CP_UID); 
	
		if ($result) {
			imap_expunge($this->mbox);
			return true;
		}

		return false;
	}
   
    /*
     * @param array $list (message IDs)
     * @param string $destFolder
	 * @return bool true on success
     */
    public function moveEmails ($msguids, $destFolder) {
		if (!($destFolder)) { throw new Exception ('Destination folder not specified, could not move', 1001); }
		if (!$this->folderExists($destFolder)) { throw new Exception ('Destination folder does not exist, could not move', 1001); }
		if (!is_array($msguids)) { throw new Exception ('Invalid format for message IDs', 1001); }
	
		$result = imap_mail_move($this->mbox, implode(',', $msguids), $destFolder, CP_UID); 
	
		if ($result) {
			imap_expunge($this->mbox);
			return true;
		}

		return false; 
	}
	
   	/*
	 * Expunge messages from a folder
	 * @param string $folder (or null to expung from current folder)
	 * @return bool true on success
	 */             
	public function expungeEmails ($folder=null) {
		imap_expunge($this->mbox);

		return true;
	}
  
	/*
	 * Gets attachment from a message
	 * @param string $msguid (message uid)
	 * @param array $parts (message parts)
	 */
	public function downloadAttachments ($msguid, $parts) {
		session_write_close();

		// make sure we have the needed info
		if (!is_numeric($msguid) || !is_array($parts)) { throw new Exception ('Message ID and part required but not specified', 1001); }

		// get the structure of the email
	   	$mesg_info = $this->TWIGGetMsgInfo(imap_fetchstructure($this->mbox, $msguid, FT_UID)); 
	
		if (count($parts) > 1) {
	   		$zip = new ZipArchive();
	   		$zipfile = SE\BASE_DIR. '/temp/' .session_id(). '.zip';
	   	   	if ($zip->open($zipfile, ZIPARCHIVE::CREATE)!==TRUE) {
				to_log('Error creating ' .$zipfile);
	   			throw new Exception ('Error creating zip file for attachments download', 1001);
	   		} 
		}
	
		for ($i=0; $i<count($parts); $i++) {
			// get the specific part
			$part_info = $mesg_info[$parts[$i]];
		   	$encoding = $part_info['encoding'];
	   		$size = $part_info['bytes'];
		   	$filename = iconv_mime_decode($part_info['filename'], 0, 'UTF-8');;
			$mimetype = $part_info['mimetype']. '/' .$part_info['mimesubtype'];

			$message = imap_fetchbody($this->mbox, $msguid, $parts[$i], FT_UID);
			if (!$message) { error_log('Error retrieving attachment (' .$parts[$i]. ') from message ' .$msguid); break; }
			switch ($encoding) {
			case 1:
				$message = imap_8bit($message);
				break;
			case 2:
				$message = imap_binary($message);
				break;
			case 3:
				$message = imap_base64($message);
				break;
			case 4:
				$message = imap_qprint($message);
				break;
			}
	
			// see if we should zip the file or not
			if (count($parts) > 1) {
				$zip->addFromString($filename, $message);
			}
		}
	
		// reset the headres for the zip
	   	if (count($parts) > 1) {
			$zip->close();
			$size = filesize($zipfile);
			$mimetype = 'application/zip';
			$filename = 'all.zip';
		} else {
			// for some reason the $size from TWIGGetMsgInfo is not correct
			$size = mb_strlen($message);
		}
	
		// build the headers
		header('Pragma: private');
		header('Cache-control: private');
		header('Cache-Control: private, must-revalidate');
		header('Accept-Ranges: bytes');
		header('Content-Length: ' .$size);
		header('Connection: close');
		header('Content-Type: '. $mimetype);
		header('Content-Disposition: attachment; filename="' .$filename. '"');
	
		// send the file
	   	if (count($parts) > 1) {
			@readfile($zipfile);
		} else {
			echo $message;
		}
	
		if (count($parts) > 1) {
			unlink($zipfile);
		}

		exit();
	}

 	/*
	 * Gets attachment data from a message
	 * @param string $msguid (message uid)
	 * @param array $parts (message parts)
	 * @param array $opts (image options like resolution/scaling)
	 */ 
	public function getAttachmentData ($msguid, $parts, $opts=null) {
		session_write_close();

		// make sure we have the needed info
		if (!is_numeric($msguid) || !is_array($parts)) { throw new Exception ('Message ID and part required but not specified', 1001); }

		// get the structure of the email
	   	$mesg_info = $this->TWIGGetMsgInfo(imap_fetchstructure($this->mbox, $msguid, FT_UID)); 

		$data = array();
   
		for ($i=0; $i<count($parts); $i++) {
			// get the specific part
			$part_info = $mesg_info[$parts[$i]];
		   	$encoding = $part_info['encoding'];
	   		$size = $part_info['bytes'];
		   	$filename = iconv_mime_decode($part_info['filename'], 0, 'UTF-8');;
			$mimetype = $part_info['mimetype']. '/' .$part_info['mimesubtype'];

			$message = imap_fetchbody($this->mbox, $msguid, $parts[$i], FT_UID);
			if (!$message) { error_log('Error retrieving attachment (' .$parts[$i]. ') from message ' .$msguid); break; }
			switch ($encoding) {
			case 1:
				$message = imap_8bit($message);
				break;
			case 2:
				$message = imap_binary($message);
				break;
			case 3:
				$message = imap_base64($message);
				break;
			case 4:
				$message = imap_qprint($message);
				break;
			}

			// if this is an image, get image info and perform options as needed
			if (strtolower($part_info['mimetype']) == 'image' || preg_match('/.*(\.jpg|\.png|\.gif)$/', $filename) !== FALSE) {
				if (!extension_loaded('gd') || !function_exists('gd_info')) {
					error_log('GD Library required but not installed');
					throw new Exception ('Error working with image data.', 1001);
				}

				// load library to get image info
				include_once(SE\BASE_DIR. '/lib/wideimage/WideImage.php');

				// perform changes to the image as needed
				$fext = strtolower(strrchr($filename, '.'));
				$orig_img = WideImage::loadFromString($message)->resizeDown(750, null)->asString($fext);

				$data[] = array('data'=>base64_encode($orig_img), 'part'=>$parts[$i], 'filename'=>$filename, 'original_size'=>$size);
				unset($orig_img);
			} else {
				$data[] = array('data'=>$message);
			}
		} 

		return $data;
	}

 	/*
	 * Gets attachment
	 * @param string $msguid (message uid)
	 * @param array $parts (message parts)
	 */ 
	public function getAttachment ($msguid, $part) {
		session_write_close();

		// make sure we have the needed info
		if (!is_numeric($msguid) || !is_numeric($part)) { throw new Exception ('Message ID and part required but not specified', 1001); }

		// get the structure of the email
	   	$mesg_info = $this->TWIGGetMsgInfo(imap_fetchstructure($this->mbox, $msguid, FT_UID)); 

		$data = array();
   
		// get the specific part
		$part_info = $mesg_info[$part];
	   	$encoding = $part_info['encoding'];
   		$size = $part_info['bytes'];
		$mimetype = $part_info['mimetype']. '/' .$part_info['mimesubtype'];

		$message = imap_fetchbody($this->mbox, $msguid, $part, FT_UID);
		if (!$message) { error_log('Error retrieving attachment (' .$parts[$i]. ') from message ' .$msguid); break; }
		switch ($encoding) {
		case 1:
			$message = imap_8bit($message);
			break;
		case 2:
			$message = imap_binary($message);
			break;
		case 3:
			$message = imap_base64($message);
			break;
		case 4:
			$message = imap_qprint($message);
			break;
		}

		echo $message;
	}
  
	/*
	 * Sets current folder
	 * @param string $foldername
	 * @return true on success
	 */
	public function setMailFolder ($foldername) {
		if (!$this->folderExists($foldername)) { throw new Exception('Folder (' .$foldername. ') not found.', 1001); }

		// save this info in the session for the next request
		$_SESSION['mailfolder'] = $foldername;

		// close the previous connection
		imap_close($this->mbox);

		// open the new connection so we can use it
		$this->mbox = imap_open(TWIG\IMAP_SERVER.$_SESSION['mailfolder'], $_SESSION['vuser'], $_SESSION['vpass']);

		return true;  
	}

	/*
	 * Get a count of new message in a folder
	 * @param string $folder (name of folder if different from current)
	 * @return int $numMessages (number of new messages in the specified folder)
	 */
	public function checkNewMessages ($folder=null) {
		return imap_num_recent($this->mbox);
	}
	
	/*
	 * Get a count of total messages in the current folder
	 * @param string $folder (name of folder if different from current)
	 * @return int $totalMessages (numbers of messages in a specified folder
	 */
	public function getTotalMessages () {
		return imap_num_msg($this->mbox);
	}

	/*
	 * Gets msgno from msguid
	 * @param string $msguid
	 */
	public function getMsgNo($msguid) {
		return imap_msgno($this->mbox, $msguid);
	}

	/*
	 * Sends an email
	 * @param array $compose {to, from, cc, bcc, subject, body}
	 * @param bool true on success
	 */
	public function sendEmail ($compose) {
	    include_once(SE\BASE_DIR. '/lib/smtp.php');
	    $mail = new MyMail;

		//
	    // attach all uploaded files
		//
		$files_to_delete = array();
		$warnings = array();
	    $userfile = (count($_FILES) > 0)?$_FILES['userfile']:array();
	    for ($i=0; $i<count($userfile['name']); $i++) {
	        // skip blank inputs
	        if (strlen(trim($_FILES['userfile']['name'][$i])) == 0) { continue; }
			if ($_FILES['userfile']['size'][$i] == 0) { $warnings[] = $_FILES['userfile']['name'][$i]. ' did not get uploaded properly'; }

			// find the fullpath for this file
	        $fullpath = SE\BASE_DIR. '/temp/' .basename($_FILES['userfile']['tmp_name'][$i]);

			// add to the list of things to delete
			$files_to_delete[] = $fullpath;

			// do the move and attach
	        if (move_uploaded_file($_FILES['userfile']['tmp_name'][$i], $fullpath )) {
				//error_log('Adding attachment ' .$fullpath);
	            $mail->AddAttachment($fullpath, $_FILES['userfile']['name'][$i]);
	        } else {
	            $warnings[] = 'Could not attach ' .$_FILES['userfile']['name'][$i]. ', upload error';
	            error_log('Error moving uploaded file ' .$_FILES['userfile']['tmp_name'][$i]. ' to ' .$fullpath);
	        }
	    }

		//
	    // attach previously attached files if needed
		//
	    if (isset($compose['parts']) && is_array($compose['parts']) && count($compose['parts']) > 0) {
	        $mesg_info = $this->TWIGGetMsgInfo(imap_fetchstructure($this->mbox, $compose['msguid'], FT_UID));

	        foreach ($compose['parts'] as $part => $attached) {
	            if ($attached != 'on') { continue; }
	            $part_info = $mesg_info[$part];
	            $fullpath = SE\BASE_DIR. '/temp/' .$compose['msguid']. '-' .$part;
	            $encoding = $part_info['encoding'];
	            $message = imap_fetchbody($this->mbox, $compose['msguid'], $part, FT_UID);
	           switch ($encoding) {
	            case 1:
	                $message = imap_8bit($message);
	                break;
	            case 2:
	                $message = imap_binary($message);
	                break;
	            case 3:
	                $message = imap_base64($message);
	                break;
	            case 4:
	                $message = imap_qprint($message);
	                break;
	            }

	            if (file_put_contents($fullpath, $message)) {
					//error_log('Adding "' .$fullpath. '"');
	                $mail->AddAttachment($fullpath, $part_info['filename']);
	            } else {
	                $warnings[] = 'The file "' .$part_info['filename']. '" did not get attached';
	            }
	        }
	    }

		//
		// get emails addresses to send to
		//
	    $toaddr = getEmailAddresses($compose['to'], '/[,;]+/');
	    if (count($toaddr) > 0) {
	        foreach($toaddr as $email => $name) { $mail->AddAddress($email, $name); }
	    }
	    $ccaddr = getEmailAddresses($compose['cc'], '/[,;]+/');
	    if (count($ccaddr) > 0) {
	        foreach($ccaddr as $email => $name) { $mail->AddCC($email, $name); }
	    }
	    $bccaddr = getEmailAddresses($compose['bcc'], '/[,;]+/');
	    if (count($bccaddr) > 0) {
	        foreach($bccaddr as $email => $name) { $mail->AddBCC($email, $name); }
	    }

	    $mail->Subject = $compose['subject'];
		if (strlen($compose['body']) == 0) { $compose['body'] = ' '; }
	    $mail->Body = $compose['body'];
		if ($compose['ishtml'] == '1') { $mail->IsHTML(true); }
	    list($fromname, $fromaddr, $replyto) = $this->getFromInfo($compose['fromemail']);
	    $mail->From = $fromaddr;
	    $mail->Sender = $fromaddr;
	    if (strlen(trim($fromname)) > 1) { $mail->FromName = $fromname; }
	    if (strlen(trim($replyto)) > 1) { $mail->AddReplyTo($replyto); }
	    if (isset($compose['priority']) && strlen($compose['priority'] > 1)) { $mail->Priority = $compose['priority']; }
	
		//
		// add relevant headers
		//
	    $mail->AddCustomHeader('X-Client-IP: ' .$_SERVER['REMOTE_ADDR']);
	    $mail->AddCustomHeader('X-User-Agent: ' .$_SERVER['HTTP_USER_AGENT']);
	    $mail->AddCustomHeader('X-TWIG-Version: 5');
	    if (isset($compose['replyto']) && strlen($compose['replyto']) > 1) { $mail->AddReplyTo('Reply-To: ' .$compose['replyto']); }
	    if (isset($compose['in-reply-to']) && strlen($compose['in-reply-to']) > 1) { $mail->AddCustomHeader('In-Reply-To: ' .$compose['in-reply-to']); }
	    if (isset($compose['references']) && strlen($compose['references']) > 1) { $mail->AddCustomHeader('References: ' .$compose['references']); }

		//
		// set sent/drafts/mbox so email will be saved in sent/drafts folder
		//
	    $mail->SentFolder = TWIG\IMAP_SERVER . TWIG\SENT_FOLDER;
	    $mail->DraftFolder = TWIG\IMAP_SERVER . TWIG\DRAFT_FOLDER;
	    $mail->mbox = $this->mbox;

		//
		// send email
		//
	    $send_status = $mail->Send();

		// remove uploaded files
		for ($i=0; $i<count($files_to_delete); $i++) {
			if (!is_file($files_to_delete[$i])) { continue; }
			unlink($files_to_delete[$i]);
		}
 
	    if (!$send_status) {
			error_log('Error sending e-mail: ' .$mail->ErrorInfo);
			return false;
		}
       
		// send back some warnings to alert the user
		if (count($warnings)) { return $warnings; }

		return true;
	}

	/*
	 * Gets from addresses for this user
	 * @param bool force update
	 */
	public function getFromAddresses ($force=false) {
		if (isset($_SESSION['fromaddresses']) && $force === false) { return $_SESSION['fromaddresses']; }

	    // get all the email addresses that belong to the user
		$db = new DB(array('host'=>SE\AUTH_DB_SERVER, 'user'=>SE\AUTH_DB_USER, 'password'=>SE\AUTH_DB_PASS, 'dbname'=>SE\AUTH_DB_DBASE)); 
    	$query = 'SELECT email FROM vusers WHERE (username = "' .$_SESSION['vuser']. '") UNION SELECT source as email FROM vusers, vforwards WHERE (vusers.username = "' .$_SESSION['vuser']. '") AND (vusers.email = vforwards.destination) ORDER BY email';
		$result = $db->query($query);
    	while ($row = $db->getRow($result)) {
        	$theaddrs[$row['email']]['name'] = '';
        	$theaddrs[$row['email']]['replyto'] = '';
        	$theaddrs[$row['email']]['isdefault'] = 0;
        	$theaddrs[$row['email']]['hidden'] = 0;
    	}
		$db = null;

	    // get all prefs for the addresses
    	$query = 'SELECT DISTINCT name, email, replyto, isdefault, hidden FROM fromaddresses WHERE (user_id = ' .$_SESSION['vid']. ')';
		$db = new DB(array('host'=>SE\DB_SERVER, 'user'=>SE\DB_USER, 'password'=>SE\DB_PASS, 'dbname'=>SE\DB_DBASE)); 
    	$result = $db->query($query);

    	// match the prefs with the addresses from the previous step
    	while ($addressprefs = $db->getRow($result)) {
        	if (isset($theaddrs[$addressprefs['email']])) {
            	$theaddrs[$addressprefs['email']]['name'] = $addressprefs['name'];
	            $theaddrs[$addressprefs['email']]['replyto'] = $addressprefs['replyto'];
    	        $theaddrs[$addressprefs['email']]['isdefault'] = $addressprefs['isdefault'];
    	        $theaddrs[$addressprefs['email']]['hidden'] = $addressprefs['hidden'];
        	}
    	}

		$_SESSION['fromaddresses'] = $theaddrs;

    	return $theaddrs;
	}

	/*
	 * Updates from address
	 * @param array [name, email, replyto, isdefault, hidden]
	 */
	public function updateFromAddress ($address) {
		// basic checks
		if (!is_array($address)) { throw new Exception ('Invalid data format for address info', 1001); }
		if (isset($address['isdefault']) && !in_array($address['isdefault'], array(0, 1))) { throw new Exception ('Invalid data format for default value', 1001); }
		if (isset($address['hidden']) && !in_array($address['hidden'], array(0, 1))) { throw new Exception ('Invalid data format for hidden value', 1001); }

		// remove existing info
		$query = 'DELETE FROM fromaddresses WHERE user_id = ' .$_SESSION['vid']. ' AND email = "' .DB::escape($address['email']). '"';
		DB::query($query);

		// default values
		if (!isset($address['isdefault'])) { $address['isdefault'] = 0; }
		if (!isset($address['hidden'])) { $address['hidden'] = 0; }

		// unset the default in the current address
		if ($address['isdefault'] == 1) {
			$query = 'UPDATE fromaddresses SET isdefault = 0 WHERE user_id = ' .$_SESSION['vid'];
			DB::query($query);
		}

		if (strlen(trim($address['name'])) > 0 || strlen(trim($address['replyto'])) > 0 || $address['isdefault'] == 1 || $address['hidden'] == 1) {
			$new_info = DB::escape($address);
			$query = 'INSERT INTO fromaddresses (user_id, email, name, replyto, isdefault, hidden) VALUES ';
			$query .= '(' .$_SESSION['vid']. ', "' .$address['email']. '", "' .$address['name']. '", "' .$address['replyto']. '", ' .$address['isdefault']. ' , ' .$address['hidden']. ')';
			DB::query($query);
		} 

		// updates info in the session and used for return
		return $this->getFromAddresses(true);
	}

	/*
	 * Gets the name and reply to info from the email
	 * @param string $email address the user wants to use
	 * @return array [name, email, replyto]
	 */
	public function getFromInfo($email) {
		if (!isset($_SESSION['fromaddresses'][$email])) { return array('', $email, ''); }

		$einfo = $_SESSION['fromaddresses'][$email];

		return array($einfo['name'], $email, $einfo['replyto']);
	}

	/*
	 * Creates a new folder
	 * @param string $parentfolder
	 * @param string $newfolder
	 * @return bool
	 */
	public function createFolder($parent, $new) {
		if (!$this->folderExists($parent)) { throw new Exception ('Parent folder (' .$parent. ') does not exist', 1001); }

		$fullpath = TWIG\IMAP_SERVER.$parent. '.' .$new;
		if ($this->folderExists($new)) { throw new Exception ('Folder (' .$new. ') already exist', 1001); }
		if (imap_createmailbox($this->mbox, imap_utf7_encode($fullpath))) {
			// folder created successfully
			error_log('Folder ' .$fullpath. ' created');
		} else {
			error_log('Folder ' .$fullpath. ' not created');
			throw new Exception ('Could not create mailbox: ' .implode(':: ', imap_errors()). '.');
		}

		return true;
	}

	/*
	 * Renames an existing folder
	 * @param string $folder (/path/to/oldfolder)
	 * @param string $newfolder (/path/to/newfolder)
	 * @return bool
	 */
	public function renameFolder($folder, $newfolder) {
		if (!$this->folderExists($folder)) { throw new Exception ('Folder (' .$folder. ') does not exist', 1001); }

		$fullpath = TWIG\IMAP_SERVER.$folder;
		$newfullpath = TWIG\IMAP_SERVER.$newfolder;
		if (imap_renamemailbox($this->mbox, imap_utf7_encode($fullpath), imap_utf7_encode($newfullpath))) {
			// folder created successfully
			error_log('Folder ' .$fullpath. ' renamed to ' .$newfullpath);
		} else {
			error_log('Folder ' .$fullpath. ' not renamed');
			throw new Exception ('Could not rename mailbox: ' .implode(':: ', imap_errors()). '.');
		}

		return true;
	}
 
	/*
	 * Deletes an existing folder
	 * @param string $folderfullpath
	 * @return bool
	 */
	public function deleteFolder($folder) {
		if (!$this->folderExists($folder)) { throw new Exception ('Folder (' .$folder. ') does not exist', 1001); }

		$fullpath = TWIG\IMAP_SERVER.$folder;
		if (imap_deletemailbox($this->mbox, imap_utf7_encode($fullpath))) {
			// folder created successfully
			error_log('Folder ' .$fullpath. ' deleted');
		} else {
			error_log('Folder ' .$fullpath. ' not deleted');
			throw new Exception ('Could not delete mailbox: ' .implode(':: ', imap_errors()). '.');
		}

		return true;
	}
 	
	/*
	 * Checks if folders exists
	 * @param string $foldername
	 * @return bool
	 */
	protected function folderExists ($foldername) {
		$folders = imap_getmailboxes($this->mbox, TWIG\IMAP_SERVER, '*');

		$fullname = imap_utf7_encode(TWIG\IMAP_SERVER.$foldername);
		for ($i=0; $i<count($folders); $i++) {
			if ($folders[$i]->name == $fullname) { return true; }
		}

   	    return false;
	}
 
	/*
	 * Gets details from a particular section of an email message
	 * @param object structure
	 * @param string section
	 */
	protected function TWIGGetMsgInfo ($structure, $section = "") {
		$fooinfo = $this->TWIGGetSectionInfo($structure, 0);

		if (isset($structure->parts)) {  // loop through parts
			$pj = count ($structure->parts);

			for($pi = 0; $pi < $pj; $pi++) {
				$pii = $pi + 1;

				if(!$section) {
					$sectiontmp = $pii;
				} elseif($fooinfo["mimetype"] == "MULTIPART") {
					$sectiontmp = ereg_replace("\.[0-9]*$", "", $section);
					$sectiontmp = $sectiontmp . "." . $pii;
				} else {
					$sectiontmp = $section . "." . $pii;
				}

				// adds to $this->tmpinfo
				$this->TWIGGetMsgInfo($structure->parts[$pi], $sectiontmp);
			}
		} else { // there are no parts
			if(!$section) { $section = 1; }
	
			$this->tmpinfo[$section] = $fooinfo;
		}
	
		return $this->tmpinfo;
	}
	
	/*
	 * Gets section info of an email address
	 * @param object $structure
	 * @param int $nullok
	 */
	protected function TWIGGetSectionInfo ($structure, $nullok = 0) {
		// Names of the primary Mime Types;
		// returned by php's imap functions
		$mime = array('TEXT', 'MULTIPART', 'MESSAGE', 'APPLICATION', 'AUDIO', 'IMAGE', 'VIDEO', 'OTHER');
		$encoding = array('7bit', '8bit', 'binary', 'base64', 'quoted-printable', 'unknown');
		$filename = null;
		$charset = null;

		// encoding
		if(isset($structure->encoding)) {
				$enctype = $encoding[$structure->encoding];
				$encnumber = $structure->encoding;
		} else {
			if($nullok) { $enctype = FALSE; }
			else{ $enctype='unknown'; }
		}

		// type
		if(isset($structure->type)) {
			$mimetype = $mime[($structure->type)];
		} else {
			if($nullok) { $mimetype = FALSE; }
			else{ $mimetype = 'TEXT'; }
		}

		// subtype
		if(isset($structure->subtype)) {
			$mimesubtype = strtoupper($structure->subtype);
		} else {
			if($nullok){ $mimesubtype = FALSE; }
			else{ $mimesubtype = 'unknown'; }
		}

		// bytes
		if(isset($structure->bytes)) {
			$bytes = $structure->bytes;
		} else {
			if($nullok) { $bytes = FALSE; }
			else{ $bytes = 'unknown'; }
		}

		// disposition
		if(isset($structure->disposition)) {
			$disposition = $structure->disposition;
		} else {
			if($nullok) { $disposition = FALSE; }
			else{ $disposition = 'unknown'; }
		}

		// filename
		if($structure->ifdparameters) {
		   while(list($key, $val) = each($structure->dparameters)) {
				if(strtoupper($val->attribute) == 'NAME' || strtoupper($val->attribute) == 'FILENAME') {
					$filename = $val->value;
				}
				if(strtoupper($val->attribute) == 'CHARSET') {
					$charset = $val->value;
				}
			}
		}

		if($structure->ifparameters) {
			while(list($key, $val) = each($structure->parameters)) {
				if(strtoupper($val->attribute) == 'NAME' || strtoupper($val->attribute) == 'FILENAME') {
					$filename = $val->value;
				}
				if(strtoupper($val->attribute) == 'CHARSET') {
					$charset = $val->value;
				}
			}
		}

		if(!$filename) {
			if($nullok) { $filename = FALSE; }
			else{ $filename = 'no__name'; }
		}

		return array('enctype'=>$enctype, 'mimetype'=>$mimetype, 'mimesubtype'=>$mimesubtype, 'filename'=>$filename, 'charset'=>$charset, 'bytes'=>$bytes, 'disposition'=>$disposition, 'encoding'=>$encnumber);
	}
}
	
?>
