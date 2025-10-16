-- Add new columns to PropertyTime table following existing cq1/aq1 pattern
-- Run this on the Pelican Property Management database

-- Drop the time_percentage column since we removed percentage sliders
ALTER TABLE dbo.PropertyTime 
DROP COLUMN time_percentage;

-- Drop the cq5_other and aq5_other columns since we removed the "Other" questions
ALTER TABLE dbo.PropertyTime 
DROP COLUMN cq5_other;

ALTER TABLE dbo.PropertyTime 
DROP COLUMN aq5_other;

-- Add new columns for the 3 new questions
-- Question 6: "I feel like the Board and I get the support we need"  
ALTER TABLE dbo.PropertyTime 
ADD cq6 INT NULL;

ALTER TABLE dbo.PropertyTime 
ADD aq6 INT NULL;

-- Question 7: "How many hours a week do you allocate to this client?"
ALTER TABLE dbo.PropertyTime 
ADD cq7 DECIMAL(5,2) NULL;

ALTER TABLE dbo.PropertyTime 
ADD aq7 DECIMAL(5,2) NULL;

