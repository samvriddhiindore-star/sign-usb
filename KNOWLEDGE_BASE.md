# SIGN - USB Knowledge Base

## Table of Contents
1. [Getting Started](#getting-started)
2. [Login & Authentication](#login--authentication)
3. [Dashboard Overview](#dashboard-overview)
4. [Machine Management](#machine-management)
5. [Profile Management](#profile-management)
6. [Portal Users](#portal-users)
7. [Reports & Analytics](#reports--analytics)
8. [Website Access Control](#website-access-control)
9. [USB Activity Logs](#usb-activity-logs)
10. [Settings](#settings)
11. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Admin credentials (provided by system administrator)
- Network access to the SIGN - USB server

### Accessing the Application
1. Open your web browser
2. Navigate to the SIGN - USB application URL (e.g., `http://localhost:3000` or your production URL)
3. You will be redirected to the login page if not authenticated

**Page URL**: `/login`

---

## Login & Authentication

### Logging In
1. **Navigate to Login Page**
   - If not already on the login page, the application will redirect you automatically
   - The login page displays the SIGN - USB logo and login form

2. **Enter Credentials**
   - **Email**: Enter your admin email address
   - **Password**: Enter your password
   - Click the "Sign In" button or press Enter

3. **Successful Login**
   - Upon successful authentication, you'll be redirected to the Dashboard
   - A success notification will appear briefly
   - Your session will remain active until you log out

**Page URLs**:
- Login: `/login`
- Dashboard: `/dashboard`

### Logging Out
1. Click on your profile/user menu in the top-right corner (if available)
2. Select "Logout" or click the logout button in the sidebar
3. You will be redirected to the login page

---

## Dashboard Overview

The Dashboard provides a comprehensive overview of your system's health and security status.

**Page URL**: `/dashboard`

### Key Performance Indicators (KPIs)

The dashboard displays 8 animated KPI cards:

1. **Total Systems**
   - Shows the total number of registered machines
   - Icon: Monitor
   - Color: Blue

2. **Online Systems**
   - Displays systems currently online (connected within last 1 minute)
   - Icon: Wifi (animated pulse for online status)
   - Color: Emerald/Green

3. **Offline Systems**
   - Shows systems that are offline (not connected in last 1 minute)
   - Icon: WifiOff
   - Color: Amber/Orange

4. **USB Enabled Systems**
   - Count of systems with USB access enabled
   - Icon: Unlock
   - Color: Cyan

5. **USB Disabled Systems**
   - Count of systems with USB access disabled
   - Icon: Lock
   - Color: Rose/Red

6. **Total Devices**
   - Total number of USB devices registered across all systems
   - Icon: HardDrive
   - Color: Purple

7. **USB Events (Today)**
   - Number of USB connection/disconnection events today
   - Icon: Activity
   - Color: Indigo

8. **USB Events (Last 7 Days)**
   - Total USB events in the past week
   - Icon: Calendar
   - Color: Violet

### System Status Matrix

The dashboard includes a system status matrix showing:
- System names
- Online/Offline status with visual indicators
- Last connected timestamp
- USB status (Enabled/Disabled)
- Quick action buttons

---

## Machine Management

### Accessing Machines Page
1. Click on **"Systems"** in the sidebar navigation
2. The machines page displays all registered systems

**Page URL**: `/systems` or `/machines`

### Viewing Machines

The machines page shows:
- **PC Name**: Computer name
- **Machine ID**: Unique identifier
- **MAC ID**: Network MAC address
- **Profile**: Assigned profile name
- **USB Status**: Enabled/Disabled indicator
- **System Status**: Online/Offline with colored badges
- **Last Connected**: Timestamp of last connection
- **Actions**: View, Edit, Enable/Disable USB buttons

### Filtering Machines

1. **By Status**
   - Use the filter dropdown at the top
   - Options: All, Online, Offline
   - Select your desired filter

2. **By Search**
   - Use the search box to find machines by:
     - PC Name
     - MAC ID
     - Machine ID

### Managing Machine USB Status

1. **Enable USB for a Machine**
   - Find the machine in the list
   - Click the "Enable USB" button or toggle switch
   - Confirm the action if prompted
   - Status will update immediately

2. **Disable USB for a Machine**
   - Find the machine in the list
   - Click the "Disable USB" button or toggle switch
   - Confirm the action if prompted
   - Status will update immediately

3. **Bulk Actions**
   - Select multiple machines using checkboxes
   - Use bulk action buttons:
     - Enable USB (Selected)
     - Disable USB (Selected)
     - Assign Profile (Selected)

### Assigning Profiles to Machines

1. **Single Machine Assignment**
   - Click "Assign Profile" on a machine row
   - Select a profile from the dropdown
   - Click "Save" or "Assign"
   - The profile will be applied immediately

2. **Bulk Profile Assignment**
   - Select multiple machines
   - Click "Assign Profile (Selected)"
   - Choose a profile from the dropdown
   - Confirm the assignment
   - All selected machines will be updated

### Viewing Machine Details

1. Click on a machine name or "View" button
2. The machine detail page shows:
   - Complete machine information
   - Assigned profile details
   - USB status history
   - Connected devices list
   - USB activity timeline

**Page URL**: `/machines/:id` (where :id is the machine ID)

---

## Profile Management

### Accessing Profiles Page
1. Click on **"Profiles"** in the sidebar navigation
2. The profiles page displays all configured profiles

**Page URL**: `/profiles`

### Viewing Profiles

The profiles list shows:
- **Profile Name**: Name of the profile
- **USB Policy**: Enable or Disable
- **Status**: Active or Inactive
- **Assigned Systems**: Number of machines using this profile
- **Actions**: Edit, Delete, View Details

### Creating a New Profile

1. **Click "Create Profile" Button**
   - Located at the top-right of the profiles page

2. **Fill in Profile Details**
   - **Profile Name**: Enter a descriptive name (e.g., "Engineering Team", "Restricted Access")
   - **Description**: Optional description of the profile's purpose
   - **USB Policy**: 
     - Select "Enable" to allow USB access
     - Select "Disable" to block USB access
   - **Status**: 
     - Select "Active" to make the profile available
     - Select "Inactive" to disable the profile

3. **Save the Profile**
   - Click "Create" or "Save" button
   - A success notification will appear
   - The new profile will appear in the profiles list

### Editing a Profile

1. **Find the Profile**
   - Locate the profile in the list
   - Click the "Edit" button or icon

2. **Modify Profile Settings**
   - Update any fields as needed:
     - Profile name
     - Description
     - USB policy
     - Status

3. **Save Changes**
   - Click "Update" or "Save"
   - Changes will be applied immediately
   - Machines using this profile will inherit the new settings

### Assigning Machines to Profiles

1. **From Profile Page**
   - Click on a profile to view details
   - Click "Assign Machines" or "Add Machines"
   - Select machines from the list
   - Click "Assign"

2. **From Machines Page**
   - Select machines
   - Use "Assign Profile" bulk action
   - Choose the profile

### Deleting a Profile

1. **Warning**: Ensure no machines are using the profile
2. Click the "Delete" button on the profile
3. Confirm the deletion
4. The profile will be removed from the system

---

## Portal Users

### Accessing Users Page
1. Click on **"Portal Users"** in the sidebar navigation
2. The users page displays all admin users

**Page URL**: `/users`

### Viewing Users

The users list shows:
- **Name**: User's full name
- **Email**: User's email address
- **Role**: Admin role (Admin, Manager, User, Viewer)
- **Status**: Active or Inactive
- **Last Login**: Timestamp of last login
- **Actions**: Edit, Delete, Reset Password

### Creating a New User

1. **Click "Create User" Button**
   - Located at the top-right of the users page

2. **Fill in User Details**
   - **Name**: User's full name
   - **Email**: Valid email address (used for login)
   - **Password**: Secure password (minimum requirements apply)
   - **Confirm Password**: Re-enter the password
   - **Role**: Select from dropdown:
     - **Admin**: Full system access
     - **Manager**: Management access
     - **User**: Standard user access
     - **Viewer**: Read-only access
   - **Status**: Active or Inactive

3. **Save the User**
   - Click "Create" button
   - Success notification will appear
   - New user can now log in

### Editing a User

1. **Find the User**
   - Locate user in the list
   - Click "Edit" button

2. **Update User Information**
   - Modify name, email, role, or status
   - Note: Password changes require a separate action

3. **Save Changes**
   - Click "Update"
   - Changes apply immediately

### Resetting User Password

1. **Access Reset Password**
   - Click "Reset Password" on a user row
   - Or use the user menu

2. **Set New Password**
   - Enter new password
   - Confirm password
   - Click "Reset"

3. **Notify User**
   - User will need to use new password on next login

### Managing User Status

1. **Activate/Deactivate User**
   - Toggle user status between Active and Inactive
   - Inactive users cannot log in
   - Status change is immediate

---

## Reports & Analytics

### Accessing Reports Page
1. Click on **"Reports"** in the sidebar navigation
2. The reports page has 4 main tabs:
   - Devices
   - Analytics
   - USB Activity
   - System Health

**Page URL**: `/reports`

### Quick Stats Overview

At the top of the reports page, you'll see 6 quick stat cards:
- Total Systems
- Online Systems
- Offline Systems
- Total Devices
- USB Events
- Inactive Systems

### Devices Tab

#### Machine-Wise Device View

1. **Viewing Machine Cards**
   - Machines are displayed as interactive cards in a grid
   - Each card shows:
     - PC Name and MAC ID
     - Online/Offline status with indicator
     - Total devices count
     - Allowed devices count (green badge)
     - Blocked devices count (red badge)
     - Progress bar showing device distribution

2. **Searching and Filtering**
   - **Search Box**: Search by PC name or MAC ID
   - **Status Filter**: Filter by All, Online, or Offline
   - Results update in real-time

3. **Viewing Machine Devices**
   - Click on any machine card
   - View detailed device information:
     - Summary cards (Total, Allowed, Blocked, Manufacturers)
     - Manufacturer breakdown with progress bars
     - Complete devices table with:
       - Device Name
       - Device ID
       - Manufacturer
       - Status (Allowed/Blocked)
       - Registration date

4. **Navigating Back**
   - Click "Back" button to return to machine list

### Analytics Tab

#### Summary Statistics

Five summary cards display:
- Total Devices
- Allowed Devices
- Blocked Devices
- Assigned Devices (with machines)
- Unassigned Devices (orphaned)

#### Top Manufacturers

- Bar chart showing most common device manufacturers
- Each entry shows:
  - Manufacturer name
  - Total device count
  - Allowed vs Blocked breakdown
  - Visual progress bar

#### Most Common Devices

- List of devices found across multiple machines
- Shows:
  - Device name
  - Number of machines using it
  - Total instances

#### Machines with Devices Table

- Comprehensive table showing:
  - Machine name and MAC ID
  - Total devices per machine
  - Allowed/Blocked breakdown
  - Last device added timestamp

#### Offline Systems with Devices

- Accordion section showing offline systems
- Each system displays:
  - System information
  - Device count
  - Last seen timestamp
  - Expandable device list

#### Recent Devices

- Table of recently registered devices
- Columns:
  - Device Name
  - Machine (or Unassigned)
  - Manufacturer
  - Status
  - Registration time

### USB Activity Tab

#### Top Machines by Activity

- Bar chart showing machines with most USB events
- Progress bars indicate relative activity levels
- Shows event count for each machine

#### Most Used Devices

- List of devices with highest usage
- Shows number of connection events
- Visual progress indicators

#### Activity Timeline

- Bar chart showing USB events over time (last 30 days)
- Hover over bars to see exact counts
- Visual representation of activity trends

#### Recent USB Activity Table

- Scrollable table of recent USB events
- Columns:
  - PC Name
  - Device Name and Manufacturer
  - Port
  - Connection Time
  - Status (Connected/Disconnected)

### System Health Tab

#### Systems by Profile

- Distribution chart showing systems grouped by profile
- Percentage breakdown
- Visual progress bars

#### USB Access Status

- Two large cards showing:
  - USB Enabled Systems (green)
  - USB Disabled Systems (red)
- Each shows count and description

#### Systems with Registered Devices

- Table showing:
  - PC Name
  - Number of registered devices
  - Progress bar indicating device count

#### Inactive Systems Alert

- Warning section for systems offline 7+ days
- Table showing:
  - PC Name
  - MAC ID
  - Last Connected timestamp
  - Remarks

### Exporting Reports

1. **Export Options**
   - Click export buttons in the header:
     - Export Devices (CSV)
     - Export USB Logs (CSV)
     - Export Systems (CSV)

2. **Download Process**
   - File downloads automatically
   - Named with current date
   - Contains all relevant data

---

## Website Access Control

### Accessing Website Control Page
1. Click on **"Website Control"** in the sidebar navigation
2. The page displays all allowed websites

**Page URL**: `/web-access-control`

### Viewing Allowed Websites

The page shows:
- **URL**: Website address
- **Created At**: When the URL was added
- **Actions**: Edit, Delete buttons

### Adding Allowed Websites

1. **Click "Add URL" Button**
   - Located at the top-right

2. **Enter URL Details**
   - **URL**: Enter the website address (e.g., `https://example.com`)
   - Click "Add" or "Save"

3. **Confirmation**
   - URL appears in the allowed list
   - Success notification appears

### Editing URLs

1. **Find the URL**
   - Locate in the list
   - Click "Edit" button

2. **Modify URL**
   - Update the website address
   - Click "Update"

### Deleting URLs

1. **Click "Delete" Button**
   - On the URL row

2. **Confirm Deletion**
   - Confirm in the dialog
   - URL is removed from allowed list

### URL Statistics

The page displays:
- **Total Allowed URLs**: Count of allowed websites
- This helps track how many websites are whitelisted

---

## USB Activity Logs

### Accessing USB Logs Page
1. Click on **"USB Logs"** in the sidebar navigation
2. The logs page displays all USB connection/disconnection events

**Page URL**: `/logs`

### Viewing USB Logs

The logs table shows:
- **PC Name**: Machine where event occurred
- **Device Name**: USB device name
- **Manufacturer**: Device manufacturer
- **Port**: USB port identifier
- **Connect Time**: When device was connected
- **Disconnect Time**: When device was disconnected (if applicable)
- **Duration**: How long device was connected
- **Status**: Connected or Disconnected

### Filtering Logs

1. **By Machine**
   - Use machine filter dropdown
   - Select specific machine or "All"

2. **By Date Range**
   - Use date picker
   - Select start and end dates
   - Click "Apply Filter"

3. **By Device Name**
   - Use search box
   - Enter device name or partial name

4. **By Status**
   - Filter by:
     - All Events
     - Currently Connected (disconnect_time IS NULL)
     - Disconnected Only

### Viewing Log Details

1. **Click on a Log Entry**
   - View detailed information:
     - Full device information
     - Connection timeline
     - Machine details
     - Related events

---

## Settings

### Accessing Settings Page
1. Click on **"Settings"** in the sidebar navigation
2. The settings page is currently a placeholder

**Page URL**: `/settings`

### Current Status

The settings page shows:
- "Coming soon" message
- Suggested sections for future implementation:
  - Organization profile and branding
  - Auth providers (SSO/MFA) and password policies
  - Notification channels and webhook integrations

---

## Troubleshooting

### Common Issues

#### Cannot Log In
- **Problem**: Login fails with error message
- **Solutions**:
  1. Verify email and password are correct
  2. Check if account is active (not inactive)
  3. Clear browser cache and cookies
  4. Try different browser
  5. Contact administrator if issue persists

#### Dashboard Not Loading
- **Problem**: Dashboard shows loading spinner indefinitely
- **Solutions**:
  1. Check internet connection
  2. Refresh the page (F5 or Ctrl+R)
  3. Check browser console for errors
  4. Verify server is running
  5. Clear browser cache

#### Machines Showing as Offline
- **Problem**: All machines appear offline
- **Solutions**:
  1. Verify machines are actually running
  2. Check if machines have network connectivity
  3. Verify agent/service is running on machines
  4. Check last_connected timestamps
  5. System is offline if last_connected > 1 minute ago

#### Reports Not Loading
- **Problem**: Reports page shows error or no data
- **Solutions**:
  1. Check browser console for errors
  2. Verify database connection
  3. Refresh the page
  4. Check if data exists in database
  5. Try exporting reports to verify data

#### USB Status Not Updating
- **Problem**: USB enable/disable not taking effect
- **Solutions**:
  1. Refresh the page
  2. Verify machine is online
  3. Check if profile is assigned correctly
  4. Verify agent is running on machine
  5. Check server logs for errors

### Browser Compatibility

**Supported Browsers**:
- Google Chrome (latest)
- Mozilla Firefox (latest)
- Microsoft Edge (latest)
- Safari (latest)

**Minimum Requirements**:
- JavaScript enabled
- Cookies enabled
- Modern browser with ES6+ support

### Keyboard Shortcuts

- **Refresh Data**: F5 or Ctrl+R
- **Search**: Ctrl+F (browser search) or use page search boxes
- **Navigate**: Use sidebar menu or browser back/forward

### Getting Help

If you encounter issues not covered here:
1. Check browser console for error messages (F12)
2. Note the steps that led to the issue
3. Contact your system administrator with:
   - Error messages
   - Steps to reproduce
   - Browser and version

---

## Best Practices

### Security
- Never share your login credentials
- Log out when finished, especially on shared computers
- Use strong, unique passwords
- Report suspicious activity immediately

### Data Management
- Regularly review and update profiles
- Monitor system health reports weekly
- Export reports for backup/audit purposes
- Keep machine information up to date

### Performance
- Use filters to narrow down large lists
- Export data instead of viewing extremely large datasets in browser
- Refresh data periodically to see latest updates
- Clear browser cache if experiencing slow performance

### Reporting
- Document profile assignments
- Keep export files for audit trails
- Review analytics regularly for trends

---

## Version Information

**Application Name**: SIGN - USB  
**Documentation Version**: 1.0  
**Last Updated**: 2025-01-24

---

## Support & Feedback

For technical support or to provide feedback:
1. Contact your system administrator
2. Check the troubleshooting section
3. Review server logs if you have access
4. Document issues with steps to reproduce

---

*This knowledge base is a living document and will be updated as new features are added to the application.*
