import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Trash2, Unlock, Save, X, Eye, EyeOff, Settings, Users, ChevronDown, ChevronRight, Check, Lock, User } from 'lucide-react';
import { useToast } from './ui/Toast.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import Button from './ui/Button.jsx';
import { Input, Textarea, Select } from './ui/FormFields.jsx';
import { Card, CardContent, CardHeader } from './ui/Card.jsx';
import { Modal, ModalContent, ModalFooter } from './ui/Modal.jsx';

const TimeSheetForm = ({ userInfo }) => {
  const { colorMode } = useTheme();
  const toast = useToast();
  
  // State
  const [communities, setCommunities] = useState([]);
  const [allCommunities, setAllCommunities] = useState([]);
  const [questionsRequired, setQuestionsRequired] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null); // 2=Accountant, 3=Manager
  const [availableRoles, setAvailableRoles] = useState([]); // [2], [3], or [2,3]
  const [roleFilteredCommunities, setRoleFilteredCommunities] = useState([]);
  const [hasShownAccessWarning, setHasShownAccessWarning] = useState(false); // Prevent duplicate toasts
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [submissionType, setSubmissionType] = useState('Manager');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminMode, setAdminMode] = useState('communities'); // 'communities' or 'users'
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [impersonatedUserCommunities, setImpersonatedUserCommunities] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [communitySearchTerm, setCommunitySearchTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showCommunityDropdown, setShowCommunityDropdown] = useState(false);
  
  // Assessment entries
  const [assessmentEntries, setAssessmentEntries] = useState([]);

  // Check if any entries have 0% allocation
  const hasZeroPercentages = assessmentEntries.some(entry => entry.timePercentage === 0);

  // Calculate total hours per week from all entries
  const totalHoursPerWeek = assessmentEntries.reduce((sum, entry) => {
    const hours = entry.responses[6] || 0; // Question 6 is the hours per week question
    return sum + parseFloat(hours);
  }, 0);

  // Available submission types
  const availableSubmissionTypes = ['Manager', 'Accounting'];

  // Question sets
  const MANAGER_QUESTIONS = [
    "Board Communication & Meeting Management: How much time do you spend on board communications, meetings, and follow-up tasks for this community?",
    "Resident Relations: How much time do you spend managing resident complaints, conflicts, and general relations?",
    "Vendor Coordination: How much time do you spend managing contractors, maintenance, and vendor relationships for this community?",
    "Compliance & Reporting: How much time do you spend on administrative, legal, and reporting requirements?",
    "I perform services outside of the contract.",
    "I feel like the Board and I get the support we need.",
    "How many hours a week do you allocate to this client?"
  ];

  const ACCOUNTING_QUESTIONS = [
    "Financial Reporting: How much time do you spend on financial statements, budgets, and reporting for this community?",
    "Accounts Payable/Receivable: How much time do you spend managing payments, collections, and vendor invoices?",
    "Compliance & Auditing: How much time do you spend on compliance requirements, audits, and regulatory filings?",
    "Board Support: How much time do you spend preparing financial materials and supporting board meetings?",
    "I perform services outside of the contract.",
    "I feel like the Board and I get the support we need.",
    "How many hours a week do you allocate to this client?"
  ];

  // Get current questions based on submission type
  const getCurrentQuestions = () => {
    return submissionType === 'Manager' ? MANAGER_QUESTIONS : ACCOUNTING_QUESTIONS;
  };

  // Check if a card should have validation errors (red border)
  const hasCardValidationErrors = (entry) => {
    // If questions are required, check question completeness
    if (questionsRequired) {
      const questions = getCurrentQuestions();
      
      // Check if all questions are answered
      for (let i = 0; i < questions.length; i++) {
        if (entry.responses[i] === undefined || entry.responses[i] === null) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Check if any entries have validation errors
  const hasValidationErrors = assessmentEntries.some(entry => hasCardValidationErrors(entry));

  // Check if form is ready for submission
  const isFormValid = assessmentEntries.length > 0 && !hasValidationErrors;

  // Fetch user communities on mount
  useEffect(() => {
    if (!userInfo || !userInfo.email) return;

    const fetchCommunities = async () => {
      try {
        const email = encodeURIComponent(userInfo.email);
        
        // Fetch user communities
        const response = await axios.get(`/api/user-communities?email=${email}`);
        const fetchedCommunities = response.data.communities || [];
        const questionsRequiredSetting = response.data.questionsRequired || false;
        
        setCommunities(fetchedCommunities);
        setQuestionsRequired(questionsRequiredSetting);
        
        // Only handle role logic for non-admin users
        if (!isAdminMode) {
          const userAvailableRoles = response.data.availableRoles || [];
          const redirectToAdmin = response.data.redirectToAdmin || false;
          
          setAvailableRoles(userAvailableRoles);
          
          // If user has no valid roles, they should use admin panel
          if (redirectToAdmin && !hasShownAccessWarning) {
            setHasShownAccessWarning(true);
            toast({
              title: 'Access Restricted',
              description: 'Please use the admin panel to access communities.',
              status: 'warning',
              duration: 5000
            });
            return;
          }
        } else {
          // Clear role state when in admin mode
          setAvailableRoles([]);
          setSelectedRole(null);
          setRoleFilteredCommunities([]);
        }

        // Fetch all communities for admin mode
        const allResponse = await axios.get('/api/admin/all-communities');
        const allCommunitiesData = allResponse.data || [];
        setAllCommunities(allCommunitiesData);

        // Auto-populate assessment entries for non-admin users
        if (!isAdminMode && fetchedCommunities.length > 0) {
          const autoEntries = fetchedCommunities.map((community, index) => ({
            id: index + 1,
            communityId: community.id || community.ID,
            responses: {},
            otherText: '',
            timePercentage: 0,
            isExpanded: false // Start all cards collapsed
          }));
          setAssessmentEntries(autoEntries);
        }

        if (fetchedCommunities.length === 0) {
          // User has no communities assigned
        }
      } catch (error) {
        console.error('Error fetching communities:', error);
      }
    };

    fetchCommunities();
  }, [userInfo?.email, isAdminMode]); // Also depend on isAdminMode
  
  // Set default role when availableRoles loads
  useEffect(() => {
    if (availableRoles.length > 0 && !selectedRole) {
      // Default to Manager (3) if available, otherwise first available role
      const defaultRole = availableRoles.includes(3) ? 3 : availableRoles[0];
      setSelectedRole(defaultRole);
    }
  }, [availableRoles]);

  // Filter communities and update form when selectedRole changes
  useEffect(() => {
    if (selectedRole && communities.length > 0) {
      // Filter communities by selected role
      const filtered = communities.filter(c => c.userRoleId === selectedRole);
      setRoleFilteredCommunities(filtered);
      
      // Set form type based on role
      const formType = selectedRole === 2 ? 'Accounting' : 'Manager';
      setSubmissionType(formType);
      
      // Reset assessment entries to match filtered communities
      if (!isAdminMode && filtered.length > 0) {
        const autoEntries = filtered.map((community, index) => ({
          id: index + 1,
          communityId: community.id || community.ID,
          responses: {},
          otherText: '',
          timePercentage: 0,
          isExpanded: false
        }));
        setAssessmentEntries(autoEntries);
      } else {
        setAssessmentEntries([]);
      }
    }
  }, [selectedRole, communities, isAdminMode]);
  
  // Fetch all users when admin mode is enabled
  useEffect(() => {
    if (isAdminMode) {
      const fetchAllUsers = async () => {
        try {
          const response = await axios.get('/api/admin/all-users');
          if (response.data.success) {
            setAllUsers(response.data.users);
          } else {
            console.error('Failed to fetch users:', response.data.message);
          }
        } catch (error) {
          console.error('Error fetching all users:', error);
        }
      };
      
      fetchAllUsers();
    }
  }, [isAdminMode]);
  
  // Handle user selection in admin mode
  const handleUserSelection = async (userEmail) => {
    if (!userEmail) {
      setSelectedUserId('');
      setImpersonatedUserCommunities([]);
      // Reset assessment entries when clearing user selection
      setAssessmentEntries([]);
      return;
    }
    
    try {
      setSelectedUserId(userEmail);
      const response = await axios.get(`/api/admin/user-communities?email=${encodeURIComponent(userEmail)}`);
      if (response.data.success) {
        setImpersonatedUserCommunities(response.data.communities);
        
        // Auto-populate assessment entries for impersonated user
        const userCommunities = response.data.communities;
        if (userCommunities.length > 0) {
          const autoEntries = userCommunities.map((community, index) => ({
            id: index + 1,
            communityId: community.id || community.ID,
            responses: {},
            otherText: '',
            timePercentage: 0,
            isExpanded: false // Start all cards collapsed
          }));
          setAssessmentEntries(autoEntries);
        } else {
          // If user has no communities, clear entries
          setAssessmentEntries([]);
        }
      }
    } catch (error) {
      console.error('Error fetching user communities:', error);
      setImpersonatedUserCommunities([]);
      setAssessmentEntries([]);
    }
  };

  // Handle clicking outside dropdowns to close them
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setShowUserDropdown(false);
        setShowCommunityDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Reset assessment entries when switching admin modes
  useEffect(() => {
    if (isAdminMode) {
      setAssessmentEntries([]);
      setSelectedUserId('');
      setSelectedCommunityId('');
      setUserSearchTerm('');
      setCommunitySearchTerm('');
      setImpersonatedUserCommunities([]);
    }
  }, [adminMode]);
  
  // Get available communities based on admin mode and role filtering
  const getAvailableCommunities = () => {
    if (!isAdminMode) return roleFilteredCommunities; // Use role-filtered communities for regular users
    
    if (adminMode === 'users' && selectedUserId) {
      return impersonatedUserCommunities;
    }
    
    return allCommunities;
  };

  // Filter functions for search
  const filteredUsers = allUsers.filter(user => {
    const searchLower = userSearchTerm.toLowerCase();
    const userName = user.user_name || '';
    const email = user.email_address || '';
    return userName.toLowerCase().includes(searchLower) || 
           email.toLowerCase().includes(searchLower);
  });

  const filteredCommunities = getAvailableCommunities().filter(community => {
    const searchLower = communitySearchTerm.toLowerCase();
    const communityName = community.name || community.NAME || '';
    return communityName.toLowerCase().includes(searchLower);
  });

  // Check if a community is already added to assessment entries
  const isCommunityAlreadyAdded = (communityId) => {
    return assessmentEntries.some(entry => entry.communityId == communityId);
  };
  
  // Handle adding entry for selected community (admin mode only)
  const handleAddCommunityEntry = () => {
    if (!isAdminMode || !selectedCommunityId) return;
    
    const newEntry = {
      id: Date.now(),
      communityId: selectedCommunityId,
      responses: {},
      otherText: '',
      timePercentage: 0,
      isExpanded: false // Start collapsed
    };
    setAssessmentEntries([...assessmentEntries, newEntry]);
    setSelectedCommunityId(''); // Clear selection after adding
    setCommunitySearchTerm(''); // Clear search term after adding
  };

  // Handle admin authentication
  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await axios.post('/api/admin/validate', {
        password: adminPassword
      });
      
      if (response.data.success) {
        setIsAdminMode(true);
        setHasShownAccessWarning(false); // Reset warning flag when entering admin mode
        setAdminPasswordError('');
        setIsAdminModalOpen(false);
        setAdminPassword('');
        
        toast({
          title: 'Admin Mode Activated',
          description: 'You now have access to all communities.',
          status: 'success',
          duration: 5000
        });
      } else {
        setAdminPasswordError('Incorrect password');
      }
    } catch (error) {
      setAdminPasswordError('Authentication failed');
    }
  };

  // Handle admin mode exit
  const handleAdminExit = () => {
    setIsAdminMode(false);
    toast({
      title: 'Admin Mode Deactivated',
      description: 'Returned to normal user mode.',
      status: 'info',
      duration: 3000
    });
  };

  // Handle assessment entry changes
  const handleAssessmentEntryChange = (entryId, field, value) => {
    setAssessmentEntries(entries =>
      entries.map(entry =>
        entry.id === entryId ? { ...entry, [field]: value } : entry
      )
    );
  };

  // Handle question responses
  const handleQuestionResponse = (entryId, questionIndex, value) => {
    setAssessmentEntries(entries =>
      entries.map(entry =>
        entry.id === entryId 
          ? { ...entry, responses: { ...entry.responses, [questionIndex]: value } }
          : entry
      )
    );
  };

  // Add new assessment entry
  const handleAddAssessmentEntry = () => {
    const newEntry = {
      id: Date.now(),
      communityId: '',
      responses: {},
      otherText: '',
      timePercentage: 0,
      isExpanded: false // Start collapsed
    };
    setAssessmentEntries([...assessmentEntries, newEntry]);
  };

  // Remove assessment entry
  const handleRemoveAssessmentEntry = (entryId) => {
    if (isAdminMode) {
      setAssessmentEntries(entries => entries.filter(entry => entry.id !== entryId));
    }
  };

  // Handle percentage slider changes
  const handlePercentageChange = (entryId, percentage) => {
    setAssessmentEntries(entries =>
      entries.map(entry =>
        entry.id === entryId ? { ...entry, timePercentage: percentage } : entry
      )
    );
  };

  // Toggle card expansion
  const toggleCardExpansion = (entryId) => {
    setAssessmentEntries(entries =>
      entries.map(entry =>
        entry.id === entryId ? { ...entry, isExpanded: !entry.isExpanded } : entry
      )
    );
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Check if there are any assessment entries
      if (assessmentEntries.length === 0) {
        throw new Error('Please add at least one community assessment entry');
      }

      // Validate entries
      for (const entry of assessmentEntries) {
        if (!entry.communityId) {
          throw new Error('Please select a community for all entries');
        }
      }

      // Submit assessment
      const response = await axios.post('/api/submit-assessment', {
        userEmail: userInfo.email,
        userName: userInfo.name,
        month: selectedMonth,
        year: selectedYear,
        submissionType,
        entries: assessmentEntries.map(entry => ({
          ...entry,
          timePercentage: entry.timePercentage || 0
        }))
      });

      if (response.data.success) {
        toast({
          title: 'Assessment Submitted',
          description: 'Your time assessment has been submitted successfully.',
          status: 'success',
          duration: 5000
        });

        // Reset form
        setAssessmentEntries([]);
      }
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: 'Submission Error',
        description: error.message || 'Failed to submit assessment',
        status: 'error',
        duration: 7000
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Admin Modal */}
      <Modal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        title="Admin Authentication"
      >
        <form onSubmit={handleAdminSubmit}>
          <ModalContent>
            <p className="mb-4 text-neutral-600 dark:text-neutral-400">
              Enter the admin password to access all communities:
            </p>
            <div className="relative">
              <Input
                type={showAdminPassword ? "text" : "password"}
                label="Password"
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword(e.target.value);
                  if (adminPasswordError) setAdminPasswordError('');
                }}
                error={adminPasswordError}
                required
              />
              <button
                type="button"
                onClick={() => setShowAdminPassword(!showAdminPassword)}
                className="absolute right-3 top-9 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 flex items-center"
                title={showAdminPassword ? "Hide password" : "Show password"}
              >
                {showAdminPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </ModalContent>
          <ModalFooter>
            <Button type="submit" variant="primary">
              Submit
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAdminModalOpen(false)}
            >
              Cancel
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Assessment Form */}
      <Card className={`max-w-6xl mx-auto relative ${isAdminMode ? 'border-2 border-neutral-400 dark:border-neutral-500' : ''}`}>
        {isAdminMode && (
          <div className="absolute -top-3 left-4 bg-neutral-200 dark:bg-neutral-700 px-3 py-1 rounded-md text-sm font-bold text-neutral-700 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-600 shadow-sm">
            Admin Mode - All Communities Available
          </div>
        )}
        
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-4">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Community Time Assessment
            </h2>
            
            <div className="flex items-center space-x-2">
              {isAdminMode && (
                <div className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-600">
                  <span className="mr-2">Admin Mode</span>
                  <button
                    onClick={handleAdminExit}
                    className="hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-full p-0.5 transition-colors"
                    title="Exit Admin Mode"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAdminModalOpen(true)}
                disabled={isAdminMode}
                leftIcon={<Unlock size={16} />}
                className="border-neutral-300 dark:border-neutral-600 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200"
              >
                Admin Panel
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Admin Mode Tabs */}
            {isAdminMode && (
              <div className="mb-6">
                <div className="flex space-x-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminMode('communities');
                      setAssessmentEntries([]); // Clear all entries when switching modes
                      setSelectedUserId(''); // Clear user selection
                      setImpersonatedUserCommunities([]);
                    }}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      adminMode === 'communities'
                        ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <Settings size={16} />
                    <span>Community Selection</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminMode('users');
                      setAssessmentEntries([]); // Clear all entries when switching modes
                      setSelectedCommunityId(''); // Clear community selection
                    }}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      adminMode === 'users'
                        ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <Users size={16} />
                    <span>User Impersonation</span>
                  </button>
                </div>
                
                {/* Admin Mode Tab Content */}
                <div className="mt-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  {adminMode === 'communities' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-neutral-900 dark:text-white">
                        Select Community to Add Entry
                      </h3>
                      <div className="flex gap-3">
                        <div className="flex-1 relative dropdown-container">
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              placeholder="Search communities..."
                              value={communitySearchTerm}
                              onChange={(e) => setCommunitySearchTerm(e.target.value)}
                              onFocus={() => setShowCommunityDropdown(true)}
                              className="flex-1"
                            />
                            {selectedCommunityId && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setSelectedCommunityId('');
                                  setCommunitySearchTerm('');
                                  setShowCommunityDropdown(false);
                                }}
                                leftIcon={<X size={16} />}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                          {showCommunityDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                              {filteredCommunities.length > 0 ? (
                                filteredCommunities.map(community => {
                                  const id = community && (community.id || community.ID);
                                  const name = community && (community.name || community.Name);
                                  const isAlreadyAdded = isCommunityAlreadyAdded(id);
                                  return (
                                    <button
                                      key={id}
                                      type="button"
                                      className={`w-full px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 text-sm text-neutral-900 dark:text-white flex items-center gap-2 ${
                                        isAlreadyAdded ? 'bg-neutral-50 dark:bg-neutral-700' : ''
                                      }`}
                                      onClick={() => {
                                        if (!isAlreadyAdded) {
                                          setSelectedCommunityId(id);
                                          setCommunitySearchTerm(name);
                                          setShowCommunityDropdown(false);
                                        }
                                      }}
                                      disabled={isAlreadyAdded}
                                    >
                                      {isAlreadyAdded && (
                                        <Check size={16} className="text-green-500 dark:text-green-400 flex-shrink-0" />
                                      )}
                                      <span className={isAlreadyAdded ? 'text-neutral-500 dark:text-neutral-400' : ''}>
                                        {name}
                                      </span>
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
                                  No communities found
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="primary"
                          onClick={handleAddCommunityEntry}
                          disabled={!selectedCommunityId}
                          leftIcon={<Plus size={16} />}
                        >
                          Add Entry
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {adminMode === 'users' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-neutral-900 dark:text-white">
                        Select User to Impersonate
                      </h3>
                      {allUsers.length > 0 && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {allUsers.length} users loaded
                        </p>
                      )}
                      <div className="space-y-3">
                        <div className="relative dropdown-container">
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              placeholder="Search users..."
                              value={userSearchTerm}
                              onChange={(e) => setUserSearchTerm(e.target.value)}
                              onFocus={() => setShowUserDropdown(true)}
                              className="flex-1"
                            />
                            {selectedUserId && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  handleUserSelection('');
                                  setUserSearchTerm('');
                                  setShowUserDropdown(false);
                                }}
                                leftIcon={<X size={16} />}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                          {showUserDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                              {filteredUsers.length > 0 ? (
                                filteredUsers.map(user => (
                                  <button
                                    key={user.email_address}
                                    type="button"
                                    className="w-full px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 text-sm text-neutral-900 dark:text-white"
                                    onClick={() => {
                                      handleUserSelection(user.email_address);
                                      setUserSearchTerm(`${user.user_name} (${user.email_address})`);
                                      setShowUserDropdown(false);
                                    }}
                                  >
                                    {user.user_name} ({user.email_address})
                                  </button>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
                                  No users found
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {selectedUserId && (
                          <div className="text-sm text-neutral-600 dark:text-neutral-400">
                            <p className="font-medium">Available Communities for {allUsers.find(u => u.email_address === selectedUserId)?.user_name}:</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {impersonatedUserCommunities.length > 0 ? (
                                impersonatedUserCommunities.map(community => (
                                  <span key={community.id} className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-secondary-100 dark:bg-secondary-800 text-secondary-800 dark:text-secondary-200">
                                    {community.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-neutral-500 dark:text-neutral-400">No communities assigned</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Role Selector - Only show for non-admin users */}
            {!isAdminMode && availableRoles.length > 0 && (
              <div className="mb-6 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <h3 className="text-sm font-medium text-neutral-900 dark:text-white mb-3">
                  Your Role & Access
                </h3>
                
                {availableRoles.length === 1 ? (
                  // Single role: Show badge with lock icon
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2 px-3 py-2 bg-secondary-100 dark:bg-secondary-800 text-secondary-800 dark:text-secondary-200 rounded-md border border-secondary-300 dark:border-secondary-600">
                      <User size={16} />
                      <span className="font-medium">
                        {selectedRole === 2 ? 'Accountant' : 'Manager'}
                      </span>
                      <Lock size={14} className="text-secondary-600 dark:text-secondary-400" />
                    </div>
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
                      Role locked • {roleFilteredCommunities.length} communities
                    </span>
                  </div>
                ) : (
                  // Multiple roles: Show dropdown
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <Select
                        label=""
                        value={selectedRole || ''}
                        onChange={(e) => setSelectedRole(parseInt(e.target.value))}
                        className="max-w-xs"
                      >
                        {availableRoles.map(roleId => (
                          <option key={roleId} value={roleId}>
                            {roleId === 2 ? 'Accountant' : 'Manager'}
                          </option>
                        ))}
                      </Select>
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {roleFilteredCommunities.length} communities available
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Switch between your roles to see different communities and form types
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Month, Year, and Submission Type Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                required
              >
                <option value={1}>January</option>
                <option value={2}>February</option>
                <option value={3}>March</option>
                <option value={4}>April</option>
                <option value={5}>May</option>
                <option value={6}>June</option>
                <option value={7}>July</option>
                <option value={8}>August</option>
                <option value={9}>September</option>
                <option value={10}>October</option>
                <option value={11}>November</option>
                <option value={12}>December</option>
              </Select>

              <Select
                label="Year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                required
              >
                <option value={2023}>2023</option>
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </Select>

              <div className="relative">
                <Select
                  label="Assessment Type"
                  value={submissionType}
                  onChange={(e) => setSubmissionType(e.target.value)}
                  disabled={!isAdminMode} // Lock for non-admin users
                  required
                  className={!isAdminMode ? 'bg-neutral-100 dark:bg-neutral-700' : ''}
                >
                  {availableSubmissionTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </Select>
                {!isAdminMode && (
                  <Lock size={16} className="absolute right-8 top-9 text-neutral-500 pointer-events-none" />
                )}
              </div>
            </div>

            {/* Total Hours Per Week Display */}
            {assessmentEntries.length > 0 && (
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-neutral-900 dark:text-white">
                    Total Hours Per Week
                  </h3>
                  <span className={`text-lg font-bold ${
                    totalHoursPerWeek > 40 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}>
                    {totalHoursPerWeek.toFixed(1)} hours
                  </span>
                </div>
                {totalHoursPerWeek > 40 && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    ⚠️ Warning: Total hours exceed 40 hours per week
                  </p>
                )}
              </div>
            )}

            {/* Assessment Entries */}
            {assessmentEntries.length > 0 ? (
              assessmentEntries.map((entry, index) => {
                // Find the community for this entry
                let selectedCommunity = null;
                
                if (isAdminMode && adminMode === 'users') {
                  // In user impersonation mode, use impersonated user's communities
                  selectedCommunity = impersonatedUserCommunities.find(c => c.id === entry.communityId);
                } else {
                  // In normal mode or admin community selection mode
                  selectedCommunity = (isAdminMode && adminMode === 'communities' ? allCommunities : communities)
                    .find(c => c.id === entry.communityId);
                }
                
                return (
                  <Card key={entry.id} className={`border-2 ${hasCardValidationErrors(entry) ? 'border-red-500 dark:border-red-400' : 'border-secondary-500 dark:border-secondary-400'}`}>
                    <CardContent>
                      {/* Collapsible Header */}
                      <div className="flex justify-between items-center mb-4">
                        <button
                          type="button"
                          onClick={() => toggleCardExpansion(entry.id)}
                          className="flex items-center space-x-2 text-left flex-1 hover:bg-neutral-50 dark:hover:bg-neutral-800 p-2 rounded-lg transition-colors"
                        >
                          {entry.isExpanded ? (
                            <ChevronDown size={20} className="text-neutral-500" />
                          ) : (
                            <ChevronRight size={20} className="text-neutral-500" />
                          )}
                          <h4 className="text-md font-medium text-neutral-900 dark:text-white">
                            {selectedCommunity ? selectedCommunity.name : `Community Assessment ${index + 1}`}
                          </h4>
                        </button>
                        {isAdminMode && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAssessmentEntry(entry.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>

                      {/* Expandable Content */}
                      {entry.isExpanded && (
                        <div className="space-y-4">
                          {/* Community Selection/Display */}
                          {!isAdminMode ? (
                            // Non-admin users: Show community name (read-only)
                            <div className="mb-4">
                              <label className="form-label">Community</label>
                              <div className="mt-1 px-3 py-2 bg-neutral-100 dark:bg-neutral-700 rounded-md border border-neutral-300 dark:border-neutral-600">
                                {(() => {
                                  const community = communities.find(c => (c.id || c.ID) == entry.communityId);
                                  return community ? (community.name || community.Name) : 'Unknown Community';
                                })()}
                              </div>
                            </div>
                          ) : adminMode === 'users' ? (
                            // Admin users in user impersonation mode: Show community name (read-only)
                            <div className="mb-4">
                              <label className="form-label">Community</label>
                              <div className="mt-1 px-3 py-2 bg-neutral-100 dark:bg-neutral-700 rounded-md border border-neutral-300 dark:border-neutral-600">
                                {(() => {
                                  const community = impersonatedUserCommunities.find(c => (c.id || c.ID) == entry.communityId);
                                  return community ? (community.name || community.Name) : 'Unknown Community';
                                })()}
                              </div>
                            </div>
                          ) : adminMode === 'communities' ? (
                            // Admin users in community selection mode: Show community name (read-only)
                            <div className="mb-4">
                              <label className="form-label">Community</label>
                              <div className="mt-1 px-3 py-2 bg-neutral-100 dark:bg-neutral-700 rounded-md border border-neutral-300 dark:border-neutral-600">
                                {(() => {
                                  const community = allCommunities.find(c => (c.id || c.ID) == entry.communityId);
                                  return community ? (community.name || community.Name) : 'Unknown Community';
                                })()}
                              </div>
                            </div>
                          ) : (
                            // Fallback: Show dropdown with available communities
                            <Select
                              label="Community"
                              value={entry.communityId}
                              onChange={(e) => handleAssessmentEntryChange(entry.id, 'communityId', e.target.value)}
                              required
                            >
                              <option value="">Select community</option>
                              {getAvailableCommunities().map(community => {
                                const id = community && (community.id || community.ID);
                                const name = community && (community.name || community.Name);
                                return (
                                  <option key={id} value={id}>{name}</option>
                                );
                              })}
                            </Select>
                          )}

                          {/* Dynamic Questions */}
                          <div className="space-y-4">
                            <h5 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                              {submissionType} Assessment Questions
                            </h5>
                            
                            {getCurrentQuestions().map((question, questionIndex) => (
                              <div key={questionIndex}>
                                <label className="form-label">
                                  {questionIndex + 1}. {question}
                                </label>
                                
                                {/* Questions 0-3: Time allocation questions with 0-4 scale */}
                                {questionIndex < 4 && (
                                  <div className="flex flex-wrap gap-6 mt-3 ml-4">
                                    {[
                                      { value: 0, label: 'None' },
                                      { value: 1, label: 'Low' },
                                      { value: 2, label: 'Medium' },
                                      { value: 3, label: 'High' },
                                      { value: 4, label: 'Very High' }
                                    ].map((option) => (
                                      <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`question-${entry.id}-${questionIndex}`}
                                          value={option.value}
                                          checked={entry.responses[questionIndex] == option.value}
                                          onChange={(e) => handleQuestionResponse(entry.id, questionIndex, parseInt(e.target.value))}
                                          className="w-4 h-4 text-secondary-500 border-neutral-300 focus:ring-secondary-500 dark:border-neutral-600 dark:bg-neutral-700"
                                        />
                                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                          {option.label}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                                
                                {/* Questions 4-5: Agreement scale questions */}
                                {(questionIndex === 4 || questionIndex === 5) && (
                                  <div className="flex flex-wrap gap-6 mt-3 ml-4">
                                    {[
                                      { value: 1, label: 'Strongly Disagree' },
                                      { value: 2, label: 'Disagree' },
                                      { value: 3, label: 'Neutral' },
                                      { value: 4, label: 'Agree' },
                                      { value: 5, label: 'Strongly Agree' }
                                    ].map((option) => (
                                      <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`question-${entry.id}-${questionIndex}`}
                                          value={option.value}
                                          checked={entry.responses[questionIndex] == option.value}
                                          onChange={(e) => handleQuestionResponse(entry.id, questionIndex, parseInt(e.target.value))}
                                          className="w-4 h-4 text-secondary-500 border-neutral-300 focus:ring-secondary-500 dark:border-neutral-600 dark:bg-neutral-700"
                                        />
                                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                          {option.label}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                                
                                {/* Question 6: Hours per week number input */}
                                {questionIndex === 6 && (
                                  <div className="mt-3 ml-4">
                                    <input
                                      type="number"
                                      min="0"
                                      max="168"
                                      step="0.5"
                                      placeholder="Enter hours per week"
                                      value={entry.responses[questionIndex] || ''}
                                      onChange={(e) => handleQuestionResponse(entry.id, questionIndex, parseFloat(e.target.value) || 0)}
                                      className="w-32 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500"
                                    />
                                    <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">hours/week</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              // Show message when no communities are available
              <div className="text-center py-12 px-6 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <p className="text-neutral-500 dark:text-neutral-400 italic text-lg">
                  No communities assigned to your account.
                </p>
                <p className="text-neutral-400 dark:text-neutral-500 text-sm mt-2">
                  Access admin mode to start adding communities for submissions.
                </p>
              </div>
            )}

            {/* Submit Button - Centered and Larger */}
            <div className="flex flex-col items-center pt-6">
              <Button
                type="submit"
                variant="primary"
                loading={isLoading}
                disabled={!isFormValid}
                leftIcon={<Save size={20} />}
                className="px-12 py-4 text-lg font-semibold"
              >
                Submit Assessment
              </Button>
              {!isFormValid && assessmentEntries.length > 0 && hasValidationErrors && (
                <div className="mt-3 text-center">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    ⚠️ Please complete all required fields (red borders indicate incomplete entries)
                  </p>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default TimeSheetForm;
