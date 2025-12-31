-- Add GUID columns to all tables

-- Add machine_uid to client_master
ALTER TABLE `client_master` 
ADD COLUMN `machine_uid` VARCHAR(36) NULL AFTER `machine_id`;

-- Add log_uid to client_usb_status
ALTER TABLE `client_usb_status` 
ADD COLUMN `log_uid` VARCHAR(36) NULL AFTER `id`;

-- Add device_uid to device_master
ALTER TABLE `device_master` 
ADD COLUMN `device_uid` VARCHAR(36) NULL AFTER `id`;

-- Add url_uid to url_master
ALTER TABLE `url_master` 
ADD COLUMN `url_uid` VARCHAR(36) NULL AFTER `id`;





