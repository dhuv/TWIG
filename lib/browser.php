<?php
/**
 * Get browser/platform information from User Agent string
 */
function getBrowserInfo($uastr=null) {
	$u_agent = ($uastr)?$uastr:$_SERVER['HTTP_USER_AGENT'];
	$bname = 'Unknown';
	$ub = 'Unknown';
	$platform = 'Unknown';
	$os_version = '';
	$version= '';

	//
	// Get platform
	//
	if (preg_match('/linux/i', $u_agent)) {
		$platform = 'Linux';
		if (preg_match('/.*Linux ([\sxi0-9\_]+).*/i', $u_agent, $matches)) {
			$os_version = trim($matches[1]);
		}
	} elseif (preg_match('/macintosh|mac os x/i', $u_agent)) {
		$platform = 'Mac OS X';
		if (preg_match('/.*mac os x([\s0-9\_]+)\).*/i', $u_agent, $matches)) {
			$os_version = str_replace('_', '.', trim($matches[1]));
		}
		if (preg_match('/ipad/i', $u_agent)) {
			$platform = 'iPad';
			if (preg_match('/.*os ([\s0-9\_]+)like.*/i', $u_agent, $matches)) {
				$os_version = str_replace('_', '.', trim($matches[1]));
			}
		} else if (preg_match('/iphone/i', $u_agent)) {
			$platform = 'iPhone';
			if (preg_match('/.*os ([\s0-9\_]+)like.*/i', $u_agent, $matches)) {
				$os_version = str_replace('_', '.', trim($matches[1]));
			}
		}
	} elseif (preg_match('/windows|win32/i', $u_agent)) {
		$platform = 'Windows';
		if (preg_match('/.*(NT 5.1).*/i', $u_agent, $matches)) {
			$os_version = 'XP';
		} else if (preg_match('/.*(NT 6.0).*/i', $u_agent, $matches)) {
			$os_version = 'Vista';
		} else if (preg_match('/.*(NT 6.1).*/i', $u_agent, $matches)) {
			$os_version = '7';
		} else if (preg_match('/.*(NT 6.2).*/i', $u_agent, $matches)) {
			$os_version = '8'; 
		} else if (preg_match('/.*(NT 10.0).*/i', $u_agent, $matches)) {
			$os_version = '10';
		}
	} elseif (preg_match('/cros/i', $u_agent)) {
		$platform = 'Chrome OS';
	}

	//
	// Get browser name
	//
	if (preg_match('/Edge/i',$u_agent)) {
		$bname = 'Microsoft Edge';
		$ub = 'Edge';
		$pattern = '/Edge\/([0-9.]+)/';
	} elseif (preg_match('/MSIE/i',$u_agent) && !preg_match('/Opera/i',$u_agent)) {
		$bname = 'Internet Explorer';
		$ub = 'MSIE';
		$pattern = '/MSIE\s([0-9.]+)/';
	} elseif (preg_match('/Trident/i',$u_agent)) {
		$bname = 'Internet Explorer';
		$ub = 'MSIE';
		$pattern = '/rv:([0-9.]+)/';
	} elseif (preg_match('/Firefox/i',$u_agent)) {
		$bname = 'Mozilla Firefox';
		$ub = 'Firefox';
		$pattern = '/Firefox\/([0-9.]+)/';
	} elseif (preg_match('/Chrome/i',$u_agent)) {
		$bname = 'Google Chrome';
		$ub = 'Chrome';
		$pattern = '/Chrome\/([0-9.]+)/';
	} elseif (preg_match('/Safari/i',$u_agent)) {
		$bname = 'Apple Safari';
		$ub = 'Safari';
		$pattern = '/Version\/([0-9.]+)/';
	} elseif (preg_match('/Opera/i',$u_agent)) {
		$bname = 'Opera';
		$ub = 'Opera';
		$pattern = '/Version\/([0-9.]+)/';
	} elseif (preg_match('/OPR/i',$u_agent)) {
		$bname = 'Opera';
		$ub = 'Opera';
		$pattern = '/OPR\/([0-9.]+)/';
	} else {
		$bname = 'Unknown';
		$ub = 'Unknown';
		$pattern = false;
	}

	//
	// Get browser version
	//
	$version = '?';
	if ($pattern) {
		preg_match($pattern, $u_agent, $matches);
		$version = (count($matches) > 0)?$matches[1]:'?';
	}

	// find out if this is the latest
	$latest_versions = ['Chrome'=>'56.0', 'Edge'=>'13.0', 'Firefox'=>'45.0', 'MSIE'=>'11.0', 'Opera'=>'12.0', 'Safari'=>'9.1', 'Unknown'=>'?'];
	$min_versions = ['Chrome'=>'46.0', 'Edge'=>'13.0', 'Firefox'=>'40.0', 'MSIE'=>'11.0', 'Opera'=>'15.0', 'Safari'=>'8.0', 'Unknown'=>'?'];
	$is_latest = ($version != '?' && isset($latest_versions[$ub]) && version_compare($version, $latest_versions[$ub]) >= 0);

	$info = [
		'userAgent' => $u_agent,
		'longname'  => $bname,
		'shortname'	=> $ub,
		'version'   => $version,
		'is_latest'	=> $is_latest,
		'platform'  => $platform,
		'os_version'=> $os_version,
		'pattern'   => $pattern
	];
	$info['latest_version'] = $latest_versions[$ub];
	$info['minimum_version'] = $min_versions[$ub];

	return $info;
} // getBrowserInfo

