-- Add OWNER to staff_role enum
alter type staff_role add value if not exists 'OWNER';
