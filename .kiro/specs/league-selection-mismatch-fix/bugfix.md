# Bugfix Requirements Document

## Introduction

The fantasy sports app currently has critical issues with league selection and data loading that prevent users from accessing their cached data and cause confusion between different sports leagues (baseball and basketball). The core problem is that the app relies on Yahoo OAuth session to determine which league is selected, but the user's actual league selection is stored in localStorage. This mismatch causes:

- "My Team" page showing blank on initial load
- Console errors when APIs fail authentication checks
- Baseball and basketball data being confused/mixed
- Inability to view cached data without active Yahoo authentication

The app should support viewing cached data from the database without requiring Yahoo authentication, and league selection should be independent of the Yahoo session state.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user selects a league in localStorage but has a Yahoo session for a different league THEN the system loads data from the wrong league based on the session instead of the localStorage selection

1.2 WHEN a user loads the "My Team" page on initial page load THEN the system shows a blank page because getSelectedLeagueId() queries based on Yahoo session which may not match the localStorage selection

1.3 WHEN a user attempts to view cached data without an active Yahoo OAuth session THEN the system returns 401 Unauthorized errors instead of returning the cached data from the database

1.4 WHEN a user has multiple leagues across different sports (baseball and basketball) THEN the system may return data from the wrong sport because league identification is based on Yahoo session rather than explicit league selection

1.5 WHEN a user clicks on "My Team" a second time THEN the system shows data because the component re-fetches and eventually resolves the league ID, but this should work on first load

1.6 WHEN APIs call getSelectedLeagueId(session) THEN the system queries the database using the Yahoo session's user GUID, which may not correspond to the league the user actually selected in the UI

### Expected Behavior (Correct)

2.1 WHEN a user selects a league in the UI THEN the system SHALL persist that selection independently of Yahoo session state and use it consistently across all API calls

2.2 WHEN a user loads the "My Team" page THEN the system SHALL immediately display the team information for the selected league without requiring a second click

2.3 WHEN a user attempts to view cached data without an active Yahoo OAuth session THEN the system SHALL return the cached data from the database without authentication errors

2.4 WHEN a user has multiple leagues across different sports THEN the system SHALL maintain complete data isolation between sports and only return data for the explicitly selected league

2.5 WHEN APIs need to identify the current league THEN the system SHALL use the user's explicit league selection (from localStorage or query parameter) rather than deriving it from the Yahoo session

2.6 WHEN a user is not authenticated with Yahoo THEN the system SHALL still allow read access to all cached data in the database for leagues the user has previously synced

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user has an active Yahoo OAuth session and syncs data THEN the system SHALL CONTINUE TO fetch live data from Yahoo and update the database cache

3.2 WHEN a user performs write operations (like updating lineup or adding notes) THEN the system SHALL CONTINUE TO require proper authentication and league ownership verification

3.3 WHEN a user syncs draft results or roster data from Yahoo THEN the system SHALL CONTINUE TO associate that data with the correct league_id in the database

3.4 WHEN a user switches between leagues using the LeagueSelector component THEN the system SHALL CONTINUE TO update the UI to reflect the newly selected league

3.5 WHEN baseball league data is stored in the database THEN the system SHALL CONTINUE TO keep it completely separate from basketball league data using the sport column and league_id foreign keys

3.6 WHEN a user has cached data for multiple leagues THEN the system SHALL CONTINUE TO allow switching between them and viewing each league's data independently
